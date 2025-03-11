import React from 'react';
import styled from 'styled-components';
import { SettlementData, User } from '../App';

interface SettlementViewProps {
  data: SettlementData;
}

// 컴포넌트 스타일 정의
const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 48px;
  align-items: center;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const IconContainer = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #FFFFFF;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
`;

const CoinIcon = styled.div`
  width: 24px;
  height: 24px;
  background-color: #FFAA00;
  border-radius: 50%;
`;

const Title = styled.h1`
  font-family: 'Pretendard', sans-serif;
  font-weight: 700;
  font-size: 30px;
  color: #FFFFFF;
  text-align: center;
`;

const PeriodTag = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px 8px;
  background-color: #1D2027;
  border-radius: 9999px;
  margin-top: 14px;
`;

const PeriodText = styled.span`
  font-family: 'Pretendard', sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #717680;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 34px;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 14px;
`;

const SectionTitle = styled.h2`
  font-family: 'Pretendard', sans-serif;
  font-weight: 700;
  font-size: 20px;
  color: #FFFFFF;
`;

const Counter = styled.div`
  display: flex;
  align-items: center;
  gap: 1px;
`;

const Count = styled.span<{ active?: boolean }>`
  font-family: 'Pretendard', sans-serif;
  font-weight: 400;
  font-size: 16px;
  color: ${props => props.active ? '#9FA3AB' : '#717680'};
`;

const UserListContainer = styled.div`
  background-color: rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const UserItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const UserName = styled.span`
  font-family: 'Pretendard', sans-serif;
  font-weight: 400;
  font-size: 16px;
  color: #717680;
`;

const StatusTag = styled.div<{ settled: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px 8px;
  background-color: ${props => props.settled ? 'rgba(0, 230, 0, 0.1)' : '#1D2027'};
  border-radius: 9999px;
`;

const StatusText = styled.span<{ settled: boolean }>`
  font-family: 'Pretendard', sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: ${props => props.settled ? '#00B505' : '#717680'};
`;

// 이름 마스킹 함수
const maskName = (name: string): string => {
  if (name.length <= 2) {
    return name[0] + '*';
  } else {
    return name[0] + '*' + name.slice(2);
  }
};

// 유저 목록 컴포넌트
const UserList: React.FC<{ users: User[] }> = ({ users }) => {
  const settledCount = users.filter(user => user.isSettled).length;
  
  return (
    <>
      <SectionHeader>
        <SectionTitle>{users.length}개 구독</SectionTitle>
        <Counter>
          <Count active>{settledCount}</Count>
          <Count>/</Count>
          <Count>{users.length}</Count>
        </Counter>
      </SectionHeader>
      <UserListContainer>
        {users.map((user, index) => (
          <UserItem key={index}>
            <UserName>{maskName(user.name)}</UserName>
            <StatusTag settled={user.isSettled}>
              <StatusText settled={user.isSettled}>
                {user.isSettled ? '정산 완료' : '입금 대기'}
              </StatusText>
            </StatusTag>
          </UserItem>
        ))}
      </UserListContainer>
    </>
  );
};

// 메인 컴포넌트
const SettlementView: React.FC<SettlementViewProps> = ({ data }) => {
  return (
    <Container>
      <Header>
        <IconContainer>
          <CoinIcon />
        </IconContainer>
        <Title>바나나 구독 정산</Title>
        <PeriodTag>
          <PeriodText>{data.period}</PeriodText>
        </PeriodTag>
      </Header>
      <Content>
        <Section>
          <UserList users={data.three} />
        </Section>
        <Section>
          <UserList users={data.four} />
        </Section>
      </Content>
    </Container>
  );
};

export default SettlementView; 