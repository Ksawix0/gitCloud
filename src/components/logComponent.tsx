import style from "../styles/log.module.css"
import {useEffect, useRef, useState} from "preact/hooks";
import {render} from "preact-render-to-string"

type GCLog = {
    title: string
    description: string | null
}

export class gcLog {
    static error(Title: string, Description: string|null = null){
        this.log("Error", Title, Description)
    }

    static info(Title: string, Description: string|null = null){
        this.log("Info", Title, Description)
    }

    private static log(Type: string, Title: string, Description: string|null = null){
        window.dispatchEvent(new CustomEvent("GCLog"+Type, {detail: {title: Title, description: Description}}))
    }
}

export default function LogComponent() {

    const [logs, setLogs] = useState<GCLog[]>([])
    const containerRef = useRef<HTMLDivElement>(null)

    const handleLog = useRef(((e:CustomEvent) => {
        (containerRef.current as HTMLDivElement).insertAdjacentHTML("beforeend",render(
            <div class={style.log + " " + (e.type == "GCLogError"? style.error : style.info)}>
                <div class={"material-symbols-outlined " + style.icon}>{e.type == "GCLogError"? "report" : "info"}</div>
                <div class={style.logContent}>
                    <div class={style.title}>{e.detail.title}</div>
                    {e.detail.description && <div class={style.description}>{e.detail.description}</div>}
                </div>
            </div>
        ));

        (containerRef.current as HTMLDivElement).lastElementChild?.addEventListener("animationend", (e:Event) => {
            (e.currentTarget as HTMLElement).remove()
        })
    })as EventListener)

    useEffect(() => {
        window.addEventListener("GCLogError", handleLog.current)
        window.addEventListener("GCLogInfo", handleLog.current)
    }, [])

    return (
        <div class={style.logsContainer} ref={containerRef}>
        </div>
    )
}