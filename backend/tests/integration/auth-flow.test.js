// SQL Server and outbound email stay at the adapter boundary; HTTP, controllers,
// bcrypt and JWT are real. This is component integration, not live SQL integration.
jest.mock('../../config/db.js',()=>{
 const d=require('../unit/mocks/dependencies.js');return {sql:d.mockSql,poolPromise:Promise.resolve(d.mockPool)};
});
jest.mock('../../utils/emailService.js',()=>({sendOTPEmail:jest.fn().mockResolvedValue({simulated:true})}));
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {register,verifyEmail,login} from '../../controllers/authCore.js';
import {mockQuery,resetDb} from '../unit/mocks/dependencies.js';
import {sendOTPEmail} from '../../utils/emailService.js';

let state,app;
const account={fullName:'Integration User',email:'integration@example.com',password:'Aa12345!',role:'EMPLOYER'};
beforeEach(()=>{
 resetDb();state={user:null,otp:null,roles:[]};process.env.JWT_SECRET='integration-only-secret';
 jest.spyOn(console,'log').mockImplementation(()=>{});
 mockQuery.mockImplementation(async(text,p)=>{
  if(text.includes('INSERT INTO users')) {state.user={user_id:1,full_name:p.fullName,email:p.email,password_hash:p.passwordHash,role_default:p.roleDefault,is_email_verified:false,status:'ACTIVE'};return {recordset:[{user_id:1}]};}
  if(text.includes('INSERT INTO user_roles'))state.roles=[{role_name:p.roleName}];
  if(text.includes('INSERT INTO email_verifications'))state.otp={verification_id:1,code:p.otpCode,expired_at:p.expiredAt,is_used:false};
  if(text.includes('FROM users WHERE email'))return {recordset:state.user&&state.user.email===p.email?[state.user]:[]};
  if(text.includes('FROM email_verifications'))return {recordset:state.otp&&!state.otp.is_used&&state.otp.code===p.code?[state.otp]:[]};
  if(text.includes('UPDATE email_verifications'))state.otp.is_used=true;
  if(text.includes('SET is_email_verified'))state.user.is_email_verified=true;
  if(text.includes('FROM user_roles'))return {recordset:state.roles};
  if(text.includes('SET refresh_token'))state.user.refresh_token=p.token;
  return {recordset:[]};
 });
 app=express();app.use(express.json());app.post('/register',register);app.post('/verify-email',verifyEmail);app.post('/login',login);
});
afterEach(()=>{delete process.env.JWT_SECRET;jest.restoreAllMocks();});

test('I01 register persists real password hash and emails persisted OTP',async()=>{
 const res=await request(app).post('/register').send(account);
 expect(res.status).toBe(201);expect(bcrypt.compareSync(account.password,state.user.password_hash)).toBe(true);
 expect(res.body.otpCode).toBe(state.otp.code);expect(sendOTPEmail).toHaveBeenCalledWith(account.email,state.otp.code,account.fullName);
});
test('I02 register then verify updates both stored records',async()=>{
 const registered=await request(app).post('/register').send(account);
 const res=await request(app).post('/verify-email').send({email:account.email,code:registered.body.otpCode});
 expect(res.status).toBe(200);expect(res.body.success).toBe(true);
 expect(state.user.is_email_verified).toBe(true);expect(state.otp.is_used).toBe(true);
});
test('I03 complete authentication flow returns verifiable JWT and persists token',async()=>{
 const registered=await request(app).post('/register').send(account);
 await request(app).post('/verify-email').send({email:account.email,code:registered.body.otpCode});
 const res=await request(app).post('/login').send(account);
 expect(res.status).toBe(200);expect(jwt.verify(res.body.token,process.env.JWT_SECRET)).toMatchObject({userId:1,email:account.email,roles:['EMPLOYER']});
 expect(state.user.refresh_token).toBe(res.body.token);expect(res.body.user.password_hash).toBeUndefined();
});
