const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));

// API 요청 프록시 설정 (필요시 추가 구현)
// 여기서는 별도 proxy middleware를 사용하지 않고, docker-compose에서 네트워크로 연결

// SPA 라우팅을 위한 설정 - 모든 경로에서 index.html 반환
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`바나나 정산 앱 서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 