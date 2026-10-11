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
import {forgotPassword,resetPassword} from '../../controllers/authController.js';
import {mockQuery,resetDb} from '../unit/mocks/dependencies.js';
import {sendOTPEmail} from '../../utils/emailService.js';

let state,app;
const account={fullName:'Integration User',email:'integration@example.com',password:'Aa12345!',role:'EMPLOYER'};
beforeEach(()=>{
 resetDb();state={user:null,otp:null,roles:[],reset:null};process.env.JWT_SECRET='integration-only-secret';
 jest.spyOn(console,'log').mockImplementation(()=>{});
 mockQuery.mockImplementation(async(text,p)=>{
  if(text.includes('INSERT INTO users')) {state.user={user_id:1,full_name:p.fullName,email:p.email,password_hash:p.passwordHash,role_default:p.roleDefault,is_email_verified:false,status:'ACTIVE'};return {recordset:[{user_id:1}]};}
  if(text.includes('INSERT INTO password_reset_tokens'))state.reset={reset_id:2,code:p.resetToken,expired_at:p.expiredAt,is_used:false};
  if(text.includes('FROM password_reset_tokens'))return {recordset:state.reset&&!state.reset.is_used&&state.reset.code===p.resetToken?[state.reset]:[]};
  if(text.includes('SET password_hash'))state.user.password_hash=p.passwordHash;
  if(text.includes('UPDATE password_reset_tokens'))state.reset.is_used=true;
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
 app=express();app.use(express.json());app.post('/register',register);app.post('/verify-email',verifyEmail);app.post('/login',login);app.post('/forgot-password',forgotPassword);app.post('/reset-password',resetPassword);
});
afterEach(()=>{delete process.env.JWT_SECRET;jest.restoreAllMocks();});

test('I01 register persists real password hash and emails persisted OTP',async()=>{
 const res=await request(app).post('/register').send(account);
 expect(res.status).toBe(201);expect(bcrypt.compareSync(account.password,state.user.password_hash)).toBe(true);
 expect(res.body.otpCode).toBe(state.otp.code);expect(sendOTPEmail).toHaveBeenCalledWith(account.email,state.otp.code,account.fullName);
});
test('I02 forgotten password reset writes real hash and consumes reset token',async()=>{
 await request(app).post('/register').send(account);
 const requested=await request(app).post('/forgot-password').send({email:account.email});
 const res=await request(app).post('/reset-password').send({email:account.email,otpCode:requested.body.resetToken,newPassword:'Bb12345!'});
 expect(res.status).toBe(200);expect(bcrypt.compareSync('Bb12345!',state.user.password_hash)).toBe(true);expect(bcrypt.compareSync(account.password,state.user.password_hash)).toBe(false);expect(state.reset.is_used).toBe(true);
});
test('I03 recovered account logs in with new password and rejects token reuse',async()=>{
 const registered=await request(app).post('/register').send(account);
 await request(app).post('/verify-email').send({email:account.email,code:registered.body.otpCode});
 const requested=await request(app).post('/forgot-password').send({email:account.email});
 const reset={email:account.email,otpCode:requested.body.resetToken,newPassword:'Bb12345!'};
 await request(app).post('/reset-password').send(reset);
 const res=await request(app).post('/login').send({email:account.email,password:reset.newPassword});
 const replay=await request(app).post('/reset-password').send(reset);
 expect(res.status).toBe(200);expect(jwt.verify(res.body.token,process.env.JWT_SECRET)).toMatchObject({userId:1,email:account.email,roles:['EMPLOYER']});expect(state.user.refresh_token).toBe(res.body.token);expect(replay.status).toBe(400);
});
