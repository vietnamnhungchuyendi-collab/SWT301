import crypto from 'crypto';
import qs from 'qs';
import moment from 'moment';
import dotenv from 'dotenv';
dotenv.config();

export const createPaymentUrl = (req, amount, orderInfo, returnUrl) => {
  let ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  if (ipAddr === '::1') ipAddr = '127.0.0.1';

  const tmnCode = process.env.VNP_TMNCODE || 'CGXZXD5P';
  const secretKey = process.env.VNP_HASHSECRET || 'RAMDUPWUPKVTNUXMUBXWFNZOBYHAHYJE';
  let vnpUrl = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

  const date = new Date();
  const createDate = moment(date).format('YYYYMMDDHHmmss');
  const orderId = moment(date).format('DDHHmmss') + Math.floor(Math.random() * 10000); // Unique Order ID

  const vnp_Params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Amount: amount * 100, // VNPay expects amount * 100
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate
  };

  const sortedParams = sortObject(vnp_Params);
  const signData = qs.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  
  sortedParams['vnp_SecureHash'] = signed;
  vnpUrl += '?' + qs.stringify(sortedParams, { encode: false });

  return vnpUrl;
};

export const verifyReturnUrl = (vnp_Params) => {
  const secureHash = vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  const sortedParams = sortObject(vnp_Params);
  const signData = qs.stringify(sortedParams, { encode: false });
  const secretKey = process.env.VNP_HASHSECRET || 'RAMDUPWUPKVTNUXMUBXWFNZOBYHAHYJE';

  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  return secureHash === signed;
};

function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  return sorted;
}
