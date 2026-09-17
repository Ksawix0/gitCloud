import {useEffect, useRef, useState} from "preact/hooks";

type jwtClaims = {
    sub: string,
    given_name: string,
    role: string,
    type: string,
    nbf: number,
    exp: number,
    iat: number,
    iss: string
}

export default function LoginComponent() {

    const usernameRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const loginPageRef = useRef<HTMLDivElement>(null);

    const [username, setUsername] = useState<string | null>(null)
    const [loginOpened, setLoginOpened] = useState<boolean>(false)

    const handleKeyUp = (e:KeyboardEvent) =>{
        if(e.key === "Escape"){
            setLoginOpened(false)
        }
    }

    const openLogin = () => {
        setLoginOpened(true);
    }

    const login = async () => {
        const apiUrl = localStorage.getItem("apiUrl")
        if (apiUrl === null){return}
        const response = await fetch(apiUrl + "/login", {
            method: "POST",
            headers: {
                'skip_zrok_interstitial': 'true'
            },
            body: JSON.stringify({
                username: usernameRef?.current?.value,
                passwdHash: passwordRef?.current?.value,
            }),
            credentials: "include"
        })

        if (response.status !== 200){
            console.log(response.status)
        }

        const respJson= await response.json() as {accessToken: string}

        localStorage.setItem("accessToken", respJson.accessToken)
        window.dispatchEvent(new CustomEvent("loginSuccess"))
        setLoginOpened(false)
    }

    const refreshTokens: () => Promise<Number> = async () => {
        const apiUrl = localStorage.getItem("apiUrl")
        if (apiUrl === null){return 400}
        const response = await fetch(apiUrl + "/refreshtokens", {
            method: "GET",
            headers: {
                'skip_zrok_interstitial': 'true'
            },
            credentials: "include"
        })

        console.log(response)
        if (response.status !== 200){
            return response.status
        }

        const respJson= (await response.json()) as {accessToken: string}

        localStorage.setItem("accessToken", respJson.accessToken)
        return 200
    }

    useEffect(() => {(async () => {
        const accessToken = localStorage.getItem("accessToken");
        if(accessToken !== null){
            const claims =  JSON.parse(atob(accessToken.split(".")[1])) as jwtClaims
            if(claims.exp < Date.now()/1000){
                console.log("Expired claims")
                const respCode = await refreshTokens()
                if(respCode !== 200){
                    return;
                }
            }

            sessionStorage.setItem("loginSuccess", "")
            setUsername(claims.given_name)
            window.dispatchEvent(new CustomEvent("loginSuccess"))
        }

    })()}, []);

    useEffect(() => {
        if(loginOpened){
            loginPageRef.current?.addEventListener("keyup", handleKeyUp)
        }else{
            loginPageRef.current?.removeEventListener("keyup", handleKeyUp)
        }
    }, [loginOpened]);

    const renderComponent= () => {
        if(username !== null) {
            return <div>{username}</div>;
        }
        if(loginOpened) {
            return (
                <div class={"loginPage"} ref={loginPageRef}>
                    <input type={"text"} required id={"username"} ref={usernameRef}/>
                    <input type={"password"} required id={"password"} ref={passwordRef}/>
                    <button onClick={login}>Login</button>
                    <button onClick={refreshTokens}>Refresh Tokens</button>
                </div>
            )
        }
        return (
            <button id="loginButton" onClick={openLogin}>
                Login
            </button>
        )
    }

    return renderComponent()
}