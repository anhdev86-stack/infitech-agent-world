#!/usr/bin/env node
// Stops the local INFI TECH Agent World server.
'use strict';
const http = require('http');
const { PORT } = require('./lib');
const req = http.request({ host: '127.0.0.1', port: PORT, path: '/shutdown', method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 1500 }, res => {
  res.resume(); console.log(res.statusCode === 204 ? 'Đã tắt server INFI TECH Agent World.' : 'Server không nhận lệnh tắt.');
});
req.on('error', () => console.log('Server INFI TECH Agent World không chạy.'));
req.end('{}');
