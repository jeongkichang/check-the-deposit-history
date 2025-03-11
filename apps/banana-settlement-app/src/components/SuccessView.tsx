import React from 'react';
import styled from 'styled-components';

interface SuccessViewProps {
  period: string;
}

// 컴포넌트 스타일 정의
const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  align-items: center;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

const IconContainer = styled.div`
  width: 70px;
  height: 70px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
`;

const IconBackground = styled.div`
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background-color: rgba(0, 230, 0, 0.15);
  position: absolute;
`;

const IconCheck = styled.div`
  width: 35px;
  height: 35px;
  border: 5.5px solid #00E600;
  border-radius: 50%;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  
  &:before {
    content: '';
    position: absolute;
    width: 15px;
    height: 10px;
    border-left: 5.5px solid #00E600;
    border-bottom: 5.5px solid #00E600;
    transform: rotate(-45deg) translate(1px, -2px);
  }
`;

// SVG로 성공 아이콘 구현
const SuccessCheckSVG = () => (
  <svg width="70" height="70" viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="35" cy="35" r="35" fill="rgba(0, 230, 0, 0.15)" />
    <circle cx="35" cy="35" r="17.5" stroke="#00E600" strokeWidth="5.5" />
    <path d="M26 35L33 42L44 28" stroke="#00E600" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Title = styled.h1`
  font-family: 'Pretendard', sans-serif;
  font-weight: 700;
  font-size: 30px;
  color: #FFFFFF;
  text-align: center;
`;

const Message = styled.p`
  font-family: 'Pretendard', sans-serif;
  font-weight: 400;
  font-size: 16px;
  color: #717680;
  text-align: center;
  line-height: 1.5;
`;

const PeriodTag = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px 8px;
  background-color: #1D2027;
  border-radius: 9999px;
`;

const PeriodText = styled.span`
  font-family: 'Pretendard', sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #717680;
`;

// 메인 컴포넌트
const SuccessView: React.FC<SuccessViewProps> = ({ period }) => {
  return (
    <Container>
      <Content>
        <IconContainer>
          <SuccessCheckSVG />
        </IconContainer>
        <Title>바나나 구독 정산 완료</Title>
        <Message>
          바나나 구독 입금이 전부 확인 됐어요<br />
          빠르게 입금해 주셔서 감사합니다
        </Message>
      </Content>
      <PeriodTag>
        <PeriodText>{period}</PeriodText>
      </PeriodTag>
    </Container>
  );
};

export default SuccessView; 