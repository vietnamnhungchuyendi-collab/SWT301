jest.mock('../../config/db.js',()=>{const d=require('./mocks/dependencies.js');return {sql:d.mockSql,poolPromise:Promise.resolve(d.mockPool)};});
jest.mock('../../utils/emailService.js',()=>({sendOTPEmail:jest.fn()}));
jest.mock('bcryptjs',()=>{const {mockCrypto}=require('../data/common.json');return {genSaltSync:jest.fn(()=>mockCrypto.salt),hashSync:jest.fn(()=>mockCrypto.newPasswordHash)};});
import {resetPassword} from '../../controllers/passwordRecovery.js';
import {mockQuery,mockQueries,resetDb,response} from './mocks/dependencies.js';
import bcrypt from 'bcryptjs';
import common from '../data/common.json';
import recovery from '../data/reset-password.json';

beforeEach(()=>{resetDb();jest.useFakeTimers().setSystemTime(new Date(common.recoveryClock));jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>{jest.useRealTimers();jest.restoreAllMocks();});

test.each(recovery.cases)('$id $name',async scenario=>{
 const data=structuredClone(scenario),expected=data.expected,body={...recovery.baseInput,...data.input};
 if(data.kind==='passwordPartitions'){
  for(const newPassword of data.passwords){const res=response();await resetPassword({body:{...body,newPassword}},res);expect(res.status).toHaveBeenCalledWith(expected.status);expect(mockQueries).toHaveLength(0);}
  return;
 }
 const token={reset_id:recovery.resetId,expired_at:new Date(Date.now()+(data.expiryOffsetMs??recovery.validExpiryOffsetMs))};
 if(!['invalidInput','unknown','queryFailure'].includes(data.kind))mockQuery.mockResolvedValueOnce({recordset:[{...recovery.user}]});
 if(['expired','success','hashingFailure'].includes(data.kind))mockQuery.mockResolvedValueOnce({recordset:[token]});
 if(data.kind==='hashingFailure')bcrypt.hashSync.mockImplementationOnce(()=>{throw new Error(common.errors.hashing);});
 if(data.kind==='queryFailure'){
  let count=0;mockQuery.mockImplementation(async()=>{if(++count===data.failAt)throw new Error(common.errors.database);return {recordset:count===1?[{...recovery.user}]:count===2?[token]:[]};});
 }
 const res=response();await resetPassword({body},res);expect(res.status).toHaveBeenCalledWith(expected.status);
 switch(data.kind){
  case 'invalidInput':
   expect(res.json.mock.calls[0][0].message).toEqual(expect.any(String));expect(mockQueries).toHaveLength(0);expect(bcrypt.hashSync).not.toHaveBeenCalled();break;
  case 'unknown':
   expect(mockQueries).toHaveLength(expected.queryCount);expect(bcrypt.hashSync).not.toHaveBeenCalled();expect(res.json.mock.calls[0][0].message).toContain(expected.message);break;
  case 'invalidToken':
   expect(mockQueries).toHaveLength(expected.queryCount);expect(mockQueries[1].text).toContain(expected.queryPredicate);expect(bcrypt.hashSync).not.toHaveBeenCalled();break;
  case 'expired':
   expect(res.json.mock.calls[0][0].message).toContain(expected.message);expect(mockQueries).toHaveLength(expected.queryCount);expect(bcrypt.hashSync).not.toHaveBeenCalled();break;
  case 'success':
   expect(res.json.mock.calls[0][0].success).toBe(expected.success);expect(mockQueries[2].inputs).toMatchObject(expected.passwordWrite);expect(mockQueries[3].inputs.resetId).toBe(expected.usedResetId);break;
  case 'queryFailure':
   expect(res.json.mock.calls[0][0].message).toContain(expected.message);expect(mockQueries).toHaveLength(expected.queryCount);expect(res.json.mock.calls[0][0].success).toBeUndefined();break;
  case 'hashingFailure':
   expect(mockQueries).toHaveLength(expected.queryCount);expect(res.json.mock.calls[0][0].success).toBeUndefined();expect(console.error).toHaveBeenCalled();break;
  default:throw new Error(`Unsupported recovery scenario: ${data.kind}`);
 }
});
