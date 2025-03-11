import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import SettlementView from './components/SettlementView';
import SuccessView from './components/SuccessView';

// 피그마 디자인을 기반으로 한 타입 정의
export interface User {
  name: string;
  isSettled: boolean;
}

export interface SettlementData {
  period: string;
  three: User[];
  four: User[];
}

const Container = styled.div`
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Pretendard', sans-serif;
`;

function App() {
  const [data, setData] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessView, setShowSuccessView] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // API URL을 직접 사용 (프록시 설정이 작동하지 않을 경우를 대비)
        const apiUrl = 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/settlement`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          // 응답이 JSON이 아닐 경우를 대비해 text로 먼저 읽음
          const textResponse = await response.text();
          console.error('API Response:', textResponse);
          
          // HTML이 반환되었는지 확인
          if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html>')) {
            throw new Error('API가 HTML을 반환했습니다. API 서버가 올바르게 실행 중인지 확인하세요.');
          } else {
            throw new Error(`서버 응답 오류: ${response.status} ${response.statusText}`);
          }
        }
        
        // 응답이 성공적이면 JSON으로 파싱
        const textResponse = await response.text();
        
        // 빈 응답 확인
        if (!textResponse.trim()) {
          throw new Error('API가 빈 응답을 반환했습니다.');
        }
        
        try {
          const result = JSON.parse(textResponse);
          console.log('Parsed API Response:', result);
          
          if (!result.period || !result.three || !result.four) {
            throw new Error('API 응답 형식이 예상과 다릅니다.');
          }
          
          setData(result);
          
          // 모든 사용자가 정산 완료되었는지 확인
          const allSettled = checkAllSettled(result);
          setShowSuccessView(allSettled);
        } catch (parseError) {
          console.error('JSON 파싱 오류:', parseError);
          throw new Error(`JSON 파싱 오류: ${textResponse.substring(0, 100)}...`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류 발생');
        console.error('API 요청 오류:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 모든 사용자가 정산 완료되었는지 확인하는 함수
  const checkAllSettled = (data: SettlementData): boolean => {
    const allUsers = [...data.three, ...data.four];
    return allUsers.every(user => user.isSettled);
  };

  if (loading) {
    return <Container>로딩 중...</Container>;
  }

  if (error) {
    return (
      <Container>
        <h2 style={{ color: 'red' }}>오류 발생</h2>
        <p>{error}</p>
        <p>
          <small>API 서버가 실행 중인지 확인하세요: http://localhost:3000/api/settlement</small>
        </p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ 
            marginTop: '20px', 
            padding: '8px 16px', 
            background: '#4A90E2', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer' 
          }}>
          다시 시도
        </button>
      </Container>
    );
  }

  if (!data) {
    return <Container>데이터가 없습니다.</Container>;
  }

  return (
    <Container>
      {showSuccessView ? (
        <SuccessView period={data.period} />
      ) : (
        <SettlementView data={data} />
      )}
    </Container>
  );
}

export default App; 