const express = require('express');
const oracledb = require('oracledb');
const fs = require('fs');
const mybatisMapper = require('mybatis-mapper');

const app = express();

// json파일에서 서비스ID에 매핑되는 테이블명 조회
const getTableName = (svcId) => {
	const data = fs.readFileSync('./prop/linkSvcList.json', 'utf-8');

	const jsonObj = JSON.parse(data);
	const jsonArr = jsonObj.rec;

	let tableName;

	for (idx in jsonArr) {
		const tmpObj = jsonArr[idx];
		if (svcId == tmpObj.svcId) {
			tableName = tmpObj.tableName;
			break;
		}
	}
	return tableName;
};

const createJsonRes = (result, desc, data) => {
	const jsonRes = {};
	jsonRes.result = result;
	jsonRes.description = desc;
	jsonRes.data = data;
	return JSON.stringify(jsonRes);
};

// 서비스ID를 path parameter로 사용하는 GET 메서드 서비스
app.get('/link/rest/env/:svcId', (req, res) => {
	const params = req.query;
	const svcId = req.params.svcId;

	// console.log(queryStr);

	let tableName;

	try {
		if (!(tableName = getTableName(svcId))) { // 서비스명에 매핑되는 테이블이 존재하지 않을 경우 에러 return
			const errMsg = '유효하지 않은 서비스입니다.';
			console.log(errMsg);
			res.send(createJsonRes('error', errMsg, []));
			return;
		}
	} catch (err) {
		const errMsg = '연계 대상 테이블 검증 오류';
		console.log(errMsg, err);
		res.send(createJsonRes('error', errMsg, []));
		return;
	}

	// 오라클 DB 접속 (tnsnames.ora 파일 정보 이용)
	oracledb.getConnection(
		{
			user: 'dcco',
			password: 'dcco192',
			connectString: 'kkbtest',
		},
		(err, conn) => {
			if (err) {
				const errMsg = 'DB 접속 실패';
				console.log(errMsg, err);
				res.send(createJsonRes('error', errMsg, []));
				return;
			}
			console.log('DB 접속성공');

			try {

				mybatisMapper.createMapper(['./mapper/app-mapper.xml']);

				const format = { language: 'sql', indent: '  ' };
				const cntQuery = mybatisMapper.getStatement('RestApiSQL', 'selectCnt' + tableName, params, format);
				const query = mybatisMapper.getStatement('RestApiSQL', 'selectList' + tableName, params, format);

				// console.log(cntQuery);
				console.log(query);

				conn.execute(cntQuery, {}, { outFormat: oracledb.OBJECT }, (err, result) => {
					// console.log(result);
					if (err) {
						let errMsg = 'QUERY 실행 에러';
						console.log(errMsg, err);
						res.send(createJsonRes('error', errMsg, []));
					} else if (result.rows[0].CNT > 1000) { // 데이터 건수가 너무 많으면 error 리턴
						let errMsg = '데이터가 1,000건 이상입니다. 조회 조건을 세분화해주세요.';
						console.log(errMsg);
						res.send(createJsonRes('error', errMsg, []));
					} else {
						conn.execute(query, {}, { outFormat: oracledb.OBJECT }, (err, result) => {
							if (err) {
								let errMsg = 'QUERY 실행 에러';
								console.log(errMsg, err);
								res.send(createJsonRes('error', errMsg, []));
								return;
							}
							console.log('success');
							let dataStr = createJsonRes('success', '', result.rows);

							// console.log(dataStr);
							res.send(dataStr);
						});
					}
				});
			} catch (err) {
				const errMsg = '데이터 조회 오류';
				console.log(errMsg, err);
				res.send(createJsonRes('error', errMsg, []));
				return;
			}
		}
	);
});

// 3000포트 리스닝
app.listen('3000', () => {
	console.log('Server start...');
});
