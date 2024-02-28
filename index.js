#!/usr/bin/env node --openssl-legacy-provider

import smb2 from "@greatnxy/smb2";
import express from "express";

// 读取变量
const argStr = process.argv[2];
if (!argStr) {
	console.error("必要参数：LOC_HOST;LOC_PORT;SMB_SVR;SMB_SHARE");
	process.exit(1);
}
let LOC_HOST, LOC_PORT, SMB_SVR, SMB_SHARE;
argStr.split(';').forEach((item) => {
	const [key, value] = item.split('=');
	eval(`${key} = '${value}';`);
});
if (!LOC_HOST || !LOC_PORT || !SMB_SVR || !SMB_SHARE) {
	// 当前参数（列出所有参数）
	console.log('LOC_HOST:', LOC_HOST);
	console.log('LOC_PORT:', LOC_PORT);
	console.log('SMB_SVR:', SMB_SVR);
	console.log('SMB_SHARE:', SMB_SHARE);

	console.error("必要参数：LOC_HOST;LOC_PORT;SMB_SVR;SMB_SHARE");
	process.exit(1);
}

// 连接到小米SMB服务器
const opt = {
	share: `\\\\${SMB_SVR}\\${SMB_SHARE}`,
	domain: 'WORKGROUP',
	username: '114514',
	password: '1919810',
	autoCloseTimeout: 0
};

// 用express搭建一个HTTP服务器，url规则为smb的路径
const app = express();

app.get('/list', async (req, res) => {
	const smb = new smb2(opt);
	const list = await new Promise((resolve) => {
		smb.readdir('', (err, files) => {
			if (err) {
				console.error(err);
				resolve([]);
			} else {
				resolve(files);
			}
		});
	});
	res.send(JSON.stringify(list));
});

app.get('/play/*', async (req, res) => {
	let path = decodeURIComponent(req.url).replace(/^\/play\//, '');
	console.log('Received play request:', path);

	const smb = new smb2(opt);

	const smbStream = await smb.createReadStream(path);
	res.setHeader('Content-Type', 'audio/mp3');
	smbStream.pipe(res);
});

app.get('/random.m3u8', async (req, res) => {
	// 随机生成一个M3U8文件，用play接口播放
	const smb = new smb2(opt);
	const list = await new Promise((resolve) => {
		smb.readdir('', (err, files) => {
			if (err) {
				console.error(err);
				resolve([]);
			} else {
				resolve(files);
			}
		});
	});

	// 生成M3U8文件
	let m3u8Content = '#EXTM3U\n';
	m3u8Content += "#EXT-X-VERSION:3\n";
	m3u8Content += "#EXT-X-ALLOW-CACHE:NO\n";
	m3u8Content += "#EXT-X-TARGETDURATION:3\n";

	// 不能重复播放
	const fileNames = [];
	for (let i = 0; i < 100; i++) {
		const randomFileName = list[Math.floor(Math.random() * list.length)];
		if (fileNames.includes(randomFileName)) {
			i--;
			continue;
		}
		fileNames.push(randomFileName);
		m3u8Content += `#EXTINF:3.000,${randomFileName}\n`;
		m3u8Content += `http://${LOC_HOST}:${LOC_PORT}/play/${encodeURIComponent(randomFileName)}\n`;
	}
	m3u8Content += "#EXT-X-ENDLIST\n";

	res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
	res.send(m3u8Content);
});

// 处理404
app.use((req, res) => {
	res.status(404).send('Not found');
});

app.listen(LOC_PORT, () => {
	console.log(`Server is running on port ${LOC_PORT}`);
});