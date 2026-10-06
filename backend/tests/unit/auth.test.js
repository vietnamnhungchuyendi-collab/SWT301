jest.mock('../../config/db.js', () => {
 const d = require('./mocks/dependencies.js');
 return {sql:d.mockSql,poolPromise:Promise.resolve(d.mockPool)};
});
jest.mock('../../utils/emailService.js', () => ({sendOTPEmail:jest.fn().mockResolvedValue({simulated:true})}));
jest.mock('bcryptjs', () => ({genSaltSync:jest.fn(()=> 'salt'),hashSync:jest.fn(()=> 'hashed'),compareSync:jest.fn(()=> true)}));
jest.mock('jsonwebtoken', () => ({sign:jest.fn(()=> 'jwt-token')}));
import {register, verifyEmail, login} from '../../controllers/authCore.js';
import {mockQuery, mockQueries, resetDb, response} from './mocks/dependencies.js';
import {sendOTPEmail} from '../../utils/emailService.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const body = {fullName:'Test User',email:'test@example.com',password:'Aa12345!',role:'FREELANCER'};
const user = {user_id:7,email:body.email,full_name:body.fullName,password_hash:'hashed',role_default:'FREELANCER',status:'ACTIVE',is_email_verified:true};
beforeEach(() => {
 resetDb();jest.useFakeTimers().setSystemTime(new Date('2026-10-07T00:00:00Z'));
 jest.spyOn(Math,'random').mockReturnValue(0.5);
 jest.spyOn(console,'log').mockImplementation(()=>{});jest.spyOn(console,'error').mockImplementation(()=>{});
 bcrypt.compareSync.mockReturnValue(true);sendOTPEmail.mockResolvedValue({simulated:true});
});
afterEach(()=> {jest.useRealTimers();jest.restoreAllMocks();});

describe('register',()=>{
 test.each([
 ['R01','missing name',{fullName:''}],['R02','missing email',{email:''}],
 ['R03','missing password',{password:''}],['R04','missing role',{role:''}],
 ['R05','invalid role',{role:'ADMIN'}],['R06','password 7 characters',{password:'Aa1234!'}],
 ['R07','no uppercase',{password:'aa12345!'}],['R08','no lowercase',{password:'AA12345!'}]
 ])('%s %s',async(id,label,patch)=>{
  const res=response();await register({body:{...body,...patch}},res);
  expect(res.status).toHaveBeenCalledWith(400);expect(res.json.mock.calls[0][0].message).toEqual(expect.any(String));
  expect(mockQueries).toHaveLength(0);expect(sendOTPEmail).not.toHaveBeenCalled();
 });
 test('R09 missing digit or special character',async()=>{
  for(const password of ['Aaabcdef!','Aa123456']) {
   const res=response();await register({body:{...body,password}},res);
   expect(res.status).toHaveBeenCalledWith(400);
   expect(res.json.mock.calls[0][0].message).toContain('Mật khẩu phải có ít nhất 8 ký tự');
  }
 });
 test('R11 duplicate email',async()=>{
  mockQuery.mockResolvedValueOnce({recordset:[{}]});const res=response();await register({body},res);
  expect(res.status).toHaveBeenCalledWith(400);expect(res.json).toHaveBeenCalledWith({message:'Email đã được sử dụng.'});
  expect(mockQueries).toHaveLength(1);expect(bcrypt.hashSync).not.toHaveBeenCalled();
 });
 test('R12 invalid phone',async()=>{
  const res=response();await register({body:{...body,phone:'123'}},res);
  expect(res.status).toHaveBeenCalledWith(400);expect(res.json.mock.calls[0][0].message).toContain('Số điện thoại không hợp lệ');
  expect(mockQueries).toHaveLength(1);expect(sendOTPEmail).not.toHaveBeenCalled();
 });
 test('R13 duplicate phone',async()=>{
  mockQuery.mockResolvedValueOnce({recordset:[]}).mockResolvedValueOnce({recordset:[{}]});const res=response();await register({body:{...body,phone:'0912345678'}},res);
  expect(res.status).toHaveBeenCalledWith(400);expect(res.json).toHaveBeenCalledWith({message:'Số điện thoại đã được sử dụng.'});
  expect(mockQueries).toHaveLength(2);expect(bcrypt.hashSync).not.toHaveBeenCalled();
 });
 test.each([['R14','freelancer',5],['R15','EMPLOYER',5]])('%s valid %s',async(id,role,count)=>{
  mockQuery.mockImplementation(async text=>({recordset:text.includes('SCOPE_IDENTITY')?[{user_id:7}]:[]}));
  const res=response();await register({body:{...body,role,...(role==='EMPLOYER'?{phone:'0912345678'}:{})}},res);
  expect(res.status).toHaveBeenCalledWith(201);expect(res.json.mock.calls[0][0]).toMatchObject({success:true,userId:7,email:body.email,otpCode:'550000'});
  expect(mockQueries).toHaveLength(count);expect(sendOTPEmail).toHaveBeenCalledWith(body.email,'550000',body.fullName);
 });
 test('R10 database failure',async()=>{
  mockQuery.mockRejectedValueOnce(new Error('offline'));const res=response();await register({body},res);
  expect(res.status).toHaveBeenCalledWith(500);expect(res.json.mock.calls[0][0].message).toContain('lỗi hệ thống');
  expect(sendOTPEmail).not.toHaveBeenCalled();expect(bcrypt.hashSync).not.toHaveBeenCalled();
 });
});

describe('verifyEmail',()=>{
 test.each([['V01',{email:'',code:'550000'}],['V02',{email:body.email,code:''}]])('%s missing input',async(id,input)=>{
  const res=response();await verifyEmail({body:input},res);
  expect(res.status).toHaveBeenCalledWith(400);expect(res.json.mock.calls[0][0].message).toContain('đầy đủ');
  expect(mockQueries).toHaveLength(0);expect(sendOTPEmail).not.toHaveBeenCalled();
 });
 test('V03 unknown account',async()=>{
  const res=response();await verifyEmail({body:{email:body.email,code:'550000'}},res);
  expect(res.status).toHaveBeenCalledWith(404);expect(res.json.mock.calls[0][0].message).toContain('Không tìm thấy');
  expect(mockQueries).toHaveLength(1);expect(mockQueries[0].inputs.email).toBe(body.email);
 });
 test('V04 already verified',async()=>{
  mockQuery.mockResolvedValueOnce({recordset:[user]});const res=response();await verifyEmail({body:{email:body.email,code:'550000'}},res);
  expect(res.status).toHaveBeenCalledWith(200);expect(res.json.mock.calls[0][0].success).toBe(true);
  expect(res.json.mock.calls[0][0].message).toContain('trước đó');expect(mockQueries).toHaveLength(1);
 });
 test.each([['V05','wrong'],['V06','used']])('%s %s OTP',async(id,code)=>{
  mockQuery.mockResolvedValueOnce({recordset:[{...user,is_email_verified:false}]}).mockResolvedValueOnce({recordset:[]});
  const res=response();await verifyEmail({body:{email:body.email,code}},res);
  expect(res.status).toHaveBeenCalledWith(400);expect(res.json.mock.calls[0][0].message).toContain('không hợp lệ');
  expect(mockQueries).toHaveLength(2);expect(mockQueries[1].inputs.code).toBe(code);
 });
 test.each([['V07',-1,400],['V08',0,200],['V09',1,200],['V10',600000,200]])('%s expiry offset %s',async(id,offset,status)=>{
  mockQuery.mockResolvedValueOnce({recordset:[{...user,is_email_verified:false}]}).mockResolvedValueOnce({recordset:[{verification_id:9,expired_at:new Date(Date.now()+offset)}]});
  const res=response();await verifyEmail({body:{email:body.email,code:'550000'}},res);
  expect(res.status).toHaveBeenCalledWith(status);expect(res.json.mock.calls[0][0].message).toEqual(expect.any(String));
  expect(mockQueries).toHaveLength(status===200?4:2);expect(mockQueries[1].inputs.userId).toBe(7);
 });
 test.each([['V11',1],['V12',2],['V13',3],['V14',4]])('%s query %s failure',async(id,fail)=>{
  let n=0;mockQuery.mockImplementation(async()=>{
   if(++n===fail)throw new Error('offline');
   return {recordset:n===1?[{...user,is_email_verified:false}]:n===2?[{verification_id:9,expired_at:new Date(Date.now()+600000)}]:[]};
  });const res=response();await verifyEmail({body:{email:body.email,code:'550000'}},res);
  expect(res.status).toHaveBeenCalledWith(500);expect(res.json.mock.calls[0][0].message).toContain('lỗi');
  expect(mockQueries).toHaveLength(fail);expect(sendOTPEmail).not.toHaveBeenCalled();
 });
 test('V15 successful update parameters',async()=>{
  mockQuery.mockResolvedValueOnce({recordset:[{...user,is_email_verified:false}]}).mockResolvedValueOnce({recordset:[{verification_id:9,expired_at:new Date(Date.now()+600000)}]});
  const res=response();await verifyEmail({body:{email:body.email,code:'550000'}},res);
  expect(res.json.mock.calls[0][0].success).toBe(true);expect(mockQueries[2].inputs.verificationId).toBe(9);
  expect(mockQueries[3].inputs.userId).toBe(7);expect(mockQueries[2].text).toContain('is_used = 1');
 });
});

describe('login',()=>{
 test.each([['L01',{email:'',password:body.password}],['L02',{email:body.email,password:''}]])('%s missing input',async(id,input)=>{
  const res=response();await login({body:input},res);
  expect(res.status).toHaveBeenCalledWith(400);expect(res.json.mock.calls[0][0].message).toContain('đầy đủ');
  expect(mockQueries).toHaveLength(0);expect(jwt.sign).not.toHaveBeenCalled();
 });
 test('L03 unknown email',async()=>{
  const res=response();await login({body},res);
  expect(res.status).toHaveBeenCalledWith(400);expect(res.json.mock.calls[0][0].message).toContain('không chính xác');
  expect(bcrypt.compareSync).not.toHaveBeenCalled();expect(jwt.sign).not.toHaveBeenCalled();
 });
 test.each([['L04','LOCKED'],['L05','SUSPENDED']])('%s status %s',async(id,status)=>{
  mockQuery.mockResolvedValueOnce({recordset:[{...user,status}]});const res=response();await login({body},res);
  expect(res.status).toHaveBeenCalledWith(403);expect(res.json.mock.calls[0][0].message).toContain(status);
  expect(bcrypt.compareSync).not.toHaveBeenCalled();expect(jwt.sign).not.toHaveBeenCalled();
 });
 test('L06 wrong password',async()=>{
  mockQuery.mockResolvedValueOnce({recordset:[user]});bcrypt.compareSync.mockReturnValue(false);const res=response();await login({body},res);
  expect(res.status).toHaveBeenCalledWith(400);expect(res.json.mock.calls[0][0].message).toContain('không chính xác');
  expect(mockQueries).toHaveLength(1);expect(jwt.sign).not.toHaveBeenCalled();
 });
 test('L07 unverified email sends OTP',async()=>{
  mockQuery.mockResolvedValueOnce({recordset:[{...user,is_email_verified:false}]});const res=response();await login({body},res);
  expect(res.status).toHaveBeenCalledWith(401);expect(res.json.mock.calls[0][0]).toMatchObject({isEmailVerified:false,otpCode:'550000'});
  expect(sendOTPEmail).toHaveBeenCalledWith(body.email,'550000',body.fullName);expect(jwt.sign).not.toHaveBeenCalled();
 });
 test.each([['L08','FREELANCER','hashed'],['L09','ADMIN',body.password],['L10','ADMIN','hashed']])('%s valid %s',async(id,role,hash)=>{
  mockQuery.mockResolvedValueOnce({recordset:[{...user,role_default:role,password_hash:hash}]}).mockResolvedValueOnce({recordset:[{role_name:role}]});
  const res=response();await login({body},res);
  expect(res.status).toHaveBeenCalledWith(200);expect(res.json.mock.calls[0][0]).toMatchObject({success:true,token:'jwt-token',user:{userId:7,roles:[role]}});
  expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({userId:7,roles:[role]}),expect.any(String),{expiresIn:'7d'});
  expect(mockQueries[2].inputs.token).toBe('jwt-token');
 });
 test.each([['L11',1],['L12',2],['L13',3]])('%s query %s failure',async(id,fail)=>{
  let n=0;mockQuery.mockImplementation(async()=>{if(++n===fail)throw new Error('offline');return {recordset:n===1?[user]:[{role_name:'FREELANCER'}]};});
  const res=response();await login({body},res);
  expect(res.status).toHaveBeenCalledWith(500);expect(res.json.mock.calls[0][0].message).toContain('lỗi');
  expect(mockQueries).toHaveLength(fail);expect(res.json.mock.calls[0][0].token).toBeUndefined();
 });
 test('L14 signing failure',async()=>{
  mockQuery.mockResolvedValueOnce({recordset:[user]}).mockResolvedValueOnce({recordset:[]});jwt.sign.mockImplementationOnce(()=>{throw new Error('key');});
  const res=response();await login({body},res);
  expect(res.status).toHaveBeenCalledWith(500);expect(res.json.mock.calls[0][0].message).toContain('lỗi');
  expect(mockQueries).toHaveLength(2);expect(res.json.mock.calls[0][0].token).toBeUndefined();
 });
 test('L15 OTP persistence failure',async()=>{
  mockQuery.mockResolvedValueOnce({recordset:[{...user,is_email_verified:false}]}).mockRejectedValueOnce(new Error('offline'));const res=response();await login({body},res);
  expect(res.status).toHaveBeenCalledWith(500);expect(sendOTPEmail).not.toHaveBeenCalled();
  expect(jwt.sign).not.toHaveBeenCalled();expect(mockQueries).toHaveLength(2);
 });
});
