jest.mock('../../config/db.js',()=>{const d=require('./mocks/dependencies.js');return {sql:d.mockSql,poolPromise:Promise.resolve(d.mockPool)};});
jest.mock('../../utils/emailService.js',()=>({sendOTPEmail:jest.fn()}));
jest.mock('bcryptjs',()=>{const {mockCrypto}=require('../data/common.json');return {genSaltSync:jest.fn(()=>mockCrypto.salt),hashSync:jest.fn(()=>mockCrypto.passwordHash),compareSync:jest.fn()};});
jest.mock('jsonwebtoken',()=>{const {mockCrypto}=require('../data/common.json');return {sign:jest.fn(()=>mockCrypto.jwt)};});
import {register,login} from '../../controllers/authCore.js';
import {mockQuery,mockQueries,resetDb,response} from './mocks/dependencies.js';
import {sendOTPEmail} from '../../utils/emailService.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import common from '../data/common.json';
import registration from '../data/register.json';
import authentication from '../data/login.json';

beforeEach(()=>{
 resetDb();jest.useFakeTimers().setSystemTime(new Date(common.authClock));
 jest.spyOn(Math,'random').mockReturnValue(common.randomValue);
 jest.spyOn(console,'log').mockImplementation(()=>{});jest.spyOn(console,'error').mockImplementation(()=>{});
 bcrypt.compareSync.mockReturnValue(true);sendOTPEmail.mockResolvedValue(common.mockEmail);
});
afterEach(()=>{jest.useRealTimers();jest.restoreAllMocks();});

describe('register',()=>{
 test.each(registration.cases)('$id $name',async scenario=>{
  const data=structuredClone(scenario),expected=data.expected,body={...registration.baseInput,...data.input};
  if(data.kind==='passwordPartitions'){
   for(const password of data.passwords){const res=response();await register({body:{...body,password}},res);expect(res.status).toHaveBeenCalledWith(expected.status);expect(res.json.mock.calls[0][0].message).toContain(expected.message);}
   return;
  }
  for(const records of data.records||[])mockQuery.mockResolvedValueOnce({recordset:records});
  if(data.kind==='databaseFailure')mockQuery.mockRejectedValueOnce(new Error(common.errors.database));
  if(data.kind==='success')mockQuery.mockImplementation(async text=>({recordset:text.includes('SCOPE_IDENTITY')?[{user_id:registration.insertedUserId}]:[]}));
  const res=response();await register({body},res);expect(res.status).toHaveBeenCalledWith(expected.status);
  switch(data.kind){
   case 'validation':
    expect(res.json.mock.calls[0][0].message).toEqual(expect.any(String));expect(mockQueries).toHaveLength(0);expect(sendOTPEmail).not.toHaveBeenCalled();break;
   case 'duplicate':
    expect(res.json).toHaveBeenCalledWith(expected.body);expect(mockQueries).toHaveLength(expected.queryCount);expect(bcrypt.hashSync).not.toHaveBeenCalled();break;
   case 'invalidPhone':
    expect(res.json.mock.calls[0][0].message).toContain(expected.message);expect(mockQueries).toHaveLength(expected.queryCount);expect(sendOTPEmail).not.toHaveBeenCalled();break;
   case 'success':
    expect(res.json.mock.calls[0][0]).toMatchObject(expected.body);expect(mockQueries).toHaveLength(expected.queryCount);expect(sendOTPEmail).toHaveBeenCalledWith(...expected.emailArgs);break;
   case 'databaseFailure':
    expect(res.json.mock.calls[0][0].message).toContain(expected.message);expect(sendOTPEmail).not.toHaveBeenCalled();expect(bcrypt.hashSync).not.toHaveBeenCalled();break;
   default:throw new Error(`Unsupported registration scenario: ${data.kind}`);
  }
 });
});

describe('login',()=>{
 test.each(authentication.cases)('$id $name',async scenario=>{
  const data=structuredClone(scenario),expected=data.expected,user={...authentication.baseUser,...data.user};
  if(!['missing','unknown','queryFailure'].includes(data.kind))mockQuery.mockResolvedValueOnce({recordset:[user]});
  if(['success','signingFailure'].includes(data.kind))mockQuery.mockResolvedValueOnce({recordset:data.roles});
  if(data.kind==='wrongPassword')bcrypt.compareSync.mockReturnValue(false);
  if(data.kind==='signingFailure')jwt.sign.mockImplementationOnce(()=>{throw new Error(common.errors.signing);});
  if(data.kind==='otpFailure')mockQuery.mockRejectedValueOnce(new Error(common.errors.database));
  if(data.kind==='queryFailure'){
   let count=0;mockQuery.mockImplementation(async()=>{if(++count===data.failAt)throw new Error(common.errors.database);return {recordset:count===1?[user]:data.roles};});
  }
  const res=response();await login({body:data.input||{...authentication.baseInput}},res);expect(res.status).toHaveBeenCalledWith(expected.status);
  switch(data.kind){
   case 'missing':
    expect(res.json.mock.calls[0][0].message).toContain(expected.message);expect(mockQueries).toHaveLength(0);expect(jwt.sign).not.toHaveBeenCalled();break;
   case 'unknown':case 'blocked':
    expect(res.json.mock.calls[0][0].message).toContain(expected.message);expect(bcrypt.compareSync).not.toHaveBeenCalled();expect(jwt.sign).not.toHaveBeenCalled();break;
   case 'wrongPassword':
    expect(res.json.mock.calls[0][0].message).toContain(expected.message);expect(mockQueries).toHaveLength(expected.queryCount);expect(jwt.sign).not.toHaveBeenCalled();break;
   case 'unverified':
    expect(res.json.mock.calls[0][0]).toMatchObject(expected.body);expect(sendOTPEmail).toHaveBeenCalledWith(...expected.emailArgs);expect(jwt.sign).not.toHaveBeenCalled();break;
   case 'success':
    expect(res.json.mock.calls[0][0]).toMatchObject(expected.body);expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining(expected.claims),expect.any(String),authentication.tokenOptions);expect(mockQueries[2].inputs.token).toBe(expected.token);break;
   case 'queryFailure':case 'signingFailure':
    expect(res.json.mock.calls[0][0].message).toContain(expected.message);expect(mockQueries).toHaveLength(expected.queryCount);expect(res.json.mock.calls[0][0].token).toBeUndefined();break;
   case 'otpFailure':
    expect(sendOTPEmail).not.toHaveBeenCalled();expect(jwt.sign).not.toHaveBeenCalled();expect(mockQueries).toHaveLength(expected.queryCount);break;
   default:throw new Error(`Unsupported login scenario: ${data.kind}`);
  }
 });
});
