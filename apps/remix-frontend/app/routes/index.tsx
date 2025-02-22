import { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export type SettlementData = {
    period: string | null;
    three: { name: string; isSettled: boolean }[];
    four: { name: string; isSettled: boolean }[];
    message?: string;
};

// 1) loader 함수
export async function loader({ request }: LoaderArgs) {
    const API_URL =
        process.env.NODE_ENV === "production"
            ? "http://api:3000"
            : "http://localhost:3000";

    try {
        const res = await fetch(`${API_URL}/api/settlement`);
        const data = (await res.json()) as SettlementData;
        return json<SettlementData>(data);
    } catch (error) {
        console.error(error);
        return json<SettlementData>({
            period: null,
            three: [],
            four: [],
            message: "API 호출 실패",
        });
    }
}

// 2) 컴포넌트
export default function IndexPage() {
    const data = useLoaderData<SettlementData>();

    if (!data.period) {
        return (
            <div style={{ padding: '1rem' }}>
                <h1>바나나 구독 정산</h1>
                <p>{data.message || '기간 정보를 찾을 수 없습니다.'}</p>
            </div>
        );
    }

    const { period, three, four } = data;
    return (
        <div style={{ padding: '1rem' }}>
            <h1>바나나 구독 정산</h1>
            <h3>기간: {period}</h3>

            <section style={{ marginBottom: '2rem' }}>
                <h2>3개 구독자</h2>
                <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                    {three.map((user, idx) => (
                        <li key={idx} style={{ margin: '0.5rem 0' }}>
                            {maskName(user.name)} :{' '}
                            {user.isSettled ? '정산완료' : '정산미완료'}
                        </li>
                    ))}
                </ul>
            </section>

            <section>
                <h2>4개 구독자</h2>
                <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                    {four.map((user, idx) => (
                        <li key={idx} style={{ margin: '0.5rem 0' }}>
                            {maskName(user.name)} :{' '}
                            {user.isSettled ? '정산완료' : '정산미완료'}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

function maskName(name: string): string {
    if (name.length <= 2) {
        return name[0] + '*님';
    } else {
        return name[0] + '*' + name.slice(2) + '님';
    }
}
