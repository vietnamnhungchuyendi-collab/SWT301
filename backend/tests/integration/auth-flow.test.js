// SQL Server and outbound email stay at the adapter boundary; HTTP, controllers,
// bcrypt and JWT are real. This is component integration, not live SQL integration.
jest.mock('../../config/db.js',()=>{
 const d=require('../unit/mocks/dependencies.js');return {sql:d.mockSql,poolPromise:Promise.resolve(d.mockPool)};
});
jest.mock('../../utils/emailService.js',()=>{const common=require('../data/common.json');return {sendOTPEmail:jest.fn().mockResolvedValue(common.mockEmail)};});
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {register,verifyEmail,login} from '../../controllers/authCore.js';
import {forgotPassword,resetPassword} from '../../controllers/authController.js';
import {mockQuery,resetDb} from '../unit/mocks/dependencies.js';
import {sendOTPEmail} from '../../utils/emailService.js';

import fixture from '../data/integration.json';

let state,app,account;
const {routes,expected}=fixture;

beforeEach(()=>{
 resetDb();account=structuredClone(fixture.account);state={user:null,otp:null,roles:[],reset:null};process.env.JWT_SECRET=fixture.jwtSecret;
 jest.spyOn(console,'log').mockImplementation(()=>{});
 mockQuery.mockImplementation(async(text,p)=>{
  if(text.includes('INSERT INTO users')) {state.user={...fixture.userDefaults,full_name:p.fullName,email:p.email,password_hash:p.passwordHash,role_default:p.roleDefault};return {recordset:[{user_id:fixture.recordIds.user}]};}
  if(text.includes('INSERT INTO password_reset_tokens'))state.reset={reset_id:fixture.recordIds.reset,code:p.resetToken,expired_at:p.expiredAt,is_used:false};
  if(text.includes('FROM password_reset_tokens'))return {recordset:state.reset&&!state.reset.is_used&&state.reset.code===p.resetToken?[state.reset]:[]};
  if(text.includes('SET password_hash'))state.user.password_hash=p.passwordHash;
  if(text.includes('UPDATE password_reset_tokens'))state.reset.is_used=true;
  if(text.includes('INSERT INTO user_roles'))state.roles=[{role_name:p.roleName}];
  if(text.includes('INSERT INTO email_verifications'))state.otp={verification_id:fixture.recordIds.otp,code:p.otpCode,expired_at:p.expiredAt,is_used:false};
  if(text.includes('FROM users WHERE email'))return {recordset:state.user&&state.user.email===p.email?[state.user]:[]};
  if(text.includes('FROM email_verifications'))return {recordset:state.otp&&!state.otp.is_used&&state.otp.code===p.code?[state.otp]:[]};
  if(text.includes('UPDATE email_verifications'))state.otp.is_used=true;
  if(text.includes('SET is_email_verified'))state.user.is_email_verified=true;
  if(text.includes('FROM user_roles'))return {recordset:state.roles};
  if(text.includes('SET refresh_token'))state.user.refresh_token=p.token;
  return {recordset:[]};
 });
 app=express();app.use(express.json());app.post(routes.register,register);app.post(routes.verify,verifyEmail);app.post(routes.login,login);app.post(routes.forgot,forgotPassword);app.post(routes.reset,resetPassword);
});
afterEach(()=>{delete process.env.JWT_SECRET;jest.restoreAllMocks();});

test(`${fixture.cases[0].id} ${fixture.cases[0].name}`,async()=>{
 const res=await request(app).post(routes.register).send(account);
 expect(res.status).toBe(expected.registerStatus);expect(bcrypt.compareSync(account.password,state.user.password_hash)).toBe(expected.newPasswordMatches);
 expect(res.body.otpCode).toBe(state.otp.code);expect(sendOTPEmail).toHaveBeenCalledWith(account.email,state.otp.code,account.fullName);
});
test(`${fixture.cases[1].id} ${fixture.cases[1].name}`,async()=>{
 await request(app).post(routes.register).send(account);
 const requested=await request(app).post(routes.forgot).send({email:account.email});
 const res=await request(app).post(routes.reset).send({email:account.email,otpCode:requested.body.resetToken,newPassword:fixture.newPassword});
 expect(res.status).toBe(expected.resetStatus);expect(bcrypt.compareSync(fixture.newPassword,state.user.password_hash)).toBe(expected.newPasswordMatches);expect(bcrypt.compareSync(account.password,state.user.password_hash)).toBe(expected.oldPasswordMatches);expect(state.reset.is_used).toBe(expected.tokenUsed);
});
test(`${fixture.cases[2].id} ${fixture.cases[2].name}`,async()=>{
 const registered=await request(app).post(routes.register).send(account);
 await request(app).post(routes.verify).send({email:account.email,code:registered.body.otpCode});
 const requested=await request(app).post(routes.forgot).send({email:account.email});
 const reset={email:account.email,otpCode:requested.body.resetToken,newPassword:fixture.newPassword};
 await request(app).post(routes.reset).send(reset);
 const res=await request(app).post(routes.login).send({email:account.email,password:reset.newPassword});
 const replay=await request(app).post(routes.reset).send(reset);
 expect(res.status).toBe(expected.loginStatus);expect(jwt.verify(res.body.token,process.env.JWT_SECRET)).toMatchObject(expected.claims);expect(state.user.refresh_token).toBe(res.body.token);expect(replay.status).toBe(expected.replayStatus);
});
