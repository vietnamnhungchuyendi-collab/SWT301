jest.mock('../../config/db.js',()=>{const d=require('./mocks/dependencies.js');return {sql:d.mockSql,poolPromise:Promise.resolve(d.mockPool)};});
jest.mock('../../utils/emailService.js',()=>({sendOTPEmail:jest.fn()}));
jest.mock('bcryptjs',()=>({genSaltSync:jest.fn(()=> 'salt'),hashSync:jest.fn(()=> 'new-hash')}));
import {resetPassword} from '../../controllers/passwordRecovery.js';
import {mockQuery,mockQueries,resetDb,response} from './mocks/dependencies.js';
import bcrypt from 'bcryptjs';
const input={email:'test@example.com',otpCode:'550000',newPassword:'Bb12345!'};
beforeEach(()=>{resetDb();jest.useFakeTimers().setSystemTime(new Date('2026-10-12T00:00:00Z'));jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>{jest.useRealTimers();jest.restoreAllMocks();});
test.each([['P01','email'],['P02','otpCode'],['P03','newPassword'],['P04','short']])('%s invalid input %s',async(id,key)=>{
 const body={...input,...(key==='short'?{newPassword:'Bb1234!'}:{[key]:''})};const res=response();await resetPassword({body},res);
 expect(res.status).toHaveBeenCalledWith(400);expect(res.json.mock.calls[0][0].message).toEqual(expect.any(String));expect(mockQueries).toHaveLength(0);expect(bcrypt.hashSync).not.toHaveBeenCalled();
});
test('P05 password character partitions',async()=>{
 for(const newPassword of ['bb12345!','BB12345!']){const res=response();await resetPassword({body:{...input,newPassword}},res);expect(res.status).toHaveBeenCalledWith(400);expect(mockQueries).toHaveLength(0);}
});
test('P06 unknown account',async()=>{const res=response();await resetPassword({body:input},res);expect(res.status).toHaveBeenCalledWith(404);expect(mockQueries).toHaveLength(1);expect(bcrypt.hashSync).not.toHaveBeenCalled();expect(res.json.mock.calls[0][0].message).toContain('tài khoản');});
test('P07 invalid or already used reset token',async()=>{
 mockQuery.mockResolvedValueOnce({recordset:[{user_id:7}]});const res=response();await resetPassword({body:input},res);
 expect(res.status).toHaveBeenCalledWith(400);expect(mockQueries).toHaveLength(2);expect(mockQueries[1].text).toContain('is_used = 0');expect(bcrypt.hashSync).not.toHaveBeenCalled();
});
test('P08 token expired one millisecond ago',async()=>{
 mockQuery.mockResolvedValueOnce({recordset:[{user_id:7}]}).mockResolvedValueOnce({recordset:[{reset_id:9,expired_at:new Date(Date.now()-1)}]});const res=response();await resetPassword({body:input},res);
 expect(res.status).toHaveBeenCalledWith(400);expect(res.json.mock.calls[0][0].message).toContain('hết hạn');expect(mockQueries).toHaveLength(2);expect(bcrypt.hashSync).not.toHaveBeenCalled();
});
test.each([['P09',0],['P10',1]])('%s token expiry offset %s',async(id,offset)=>{
 mockQuery.mockResolvedValueOnce({recordset:[{user_id:7}]}).mockResolvedValueOnce({recordset:[{reset_id:9,expired_at:new Date(Date.now()+offset)}]});const res=response();await resetPassword({body:input},res);
 expect(res.status).toHaveBeenCalledWith(200);expect(res.json.mock.calls[0][0].success).toBe(true);expect(mockQueries[2].inputs).toMatchObject({userId:7,passwordHash:'new-hash'});expect(mockQueries[3].inputs.resetId).toBe(9);
});
test.each([['P11',1],['P12',2],['P13',3],['P14',4]])('%s database query %s fails',async(id,fail)=>{
 let count=0;mockQuery.mockImplementation(async()=>{if(++count===fail)throw new Error('offline');return {recordset:count===1?[{user_id:7}]:count===2?[{reset_id:9,expired_at:new Date(Date.now()+600000)}]:[]};});const res=response();await resetPassword({body:input},res);
 expect(res.status).toHaveBeenCalledWith(500);expect(res.json.mock.calls[0][0].message).toContain('lỗi hệ thống');expect(mockQueries).toHaveLength(fail);expect(res.json.mock.calls[0][0].success).toBeUndefined();
});
test('P15 hashing fails before password write',async()=>{
 mockQuery.mockResolvedValueOnce({recordset:[{user_id:7}]}).mockResolvedValueOnce({recordset:[{reset_id:9,expired_at:new Date(Date.now()+600000)}]});bcrypt.hashSync.mockImplementationOnce(()=>{throw new Error('hash error');});const res=response();await resetPassword({body:input},res);
 expect(res.status).toHaveBeenCalledWith(500);expect(mockQueries).toHaveLength(2);expect(res.json.mock.calls[0][0].success).toBeUndefined();expect(console.error).toHaveBeenCalled();
});
