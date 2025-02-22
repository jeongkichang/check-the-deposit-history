import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
    Links,
    LiveReload,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "@remix-run/react";

export const meta: MetaFunction = () => ({
    charset: "utf-8",
    title: "Remix App",
    viewport: "width=device-width,initial-scale=1",
});

export const links: LinksFunction = () => {
    return [
        // 여기에 <link> 관련 설정을 넣을 수 있습니다.
    ];
};

export default function Root() {
    return (
        <html lang="en">
        <head>
            <Meta />
            <Links />
        </head>
        <body>
        {/* 자식 라우트가 렌더링되는 위치 */}
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        </body>
        </html>
    );
}
