import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "preact/hooks";
import type {ComponentChildren, TargetedMouseEvent} from "preact";
import NewFileComponent from "./NewFileComponent.tsx";
import {gcLog} from "./logComponent.tsx";
interface gitCloudGetResponse{
    type: string;
    name: string;
    byteSize: number;
    entities: gitCloudGetResponse[];
}


const defaultServerAddress = "https://gitcloudapi.shares.zrok.io"

export default function ExplorerComponent() {
    const path = useRef<string>(new URLSearchParams(window.location.search).get("q") ?? "")

    const apiUrl = useRef<string>(localStorage.getItem("apiUrl") ?? defaultServerAddress);

    const [info, setInfo] = useState<ComponentChildren|null>(null);
    const [login, setLogin] = useState<boolean|null>(false);

    const [elements, setElements] = useState<gitCloudGetResponse[]>([])
    const [selected, setSelected] = useState<Set<number>>(new Set<number>())
    const elementsRendered = useMemo(() =>{
        if(info !== null){

            return(<div style={{display: "flex", flexGrow: "1", alignItems:"center", justifyContent: "center"}}>{info}</div>)

        }else{
            return(
                <table class={"elements"}>
                    <thead>
                        <tr class={"element elementsInfo"}>
                            <td class={"elementIcon"}></td>
                            <td class={"elementName"}>Name</td>
                            <td class={"elementSize"}>Size</td>
                        </tr>
                    </thead>
                    <tbody onClick={(e ) => {
                        if((e.target as Element).tagName === "TBODY"){
                            setSelected(new Set<number>())
                        }
                    }}>
                    {elements.map((item, index) => {
                        if (item.type === "dir") {
                            return(
                                <tr class={"element"} onDblClick={() => changePath(index)}>
                                    <td class={"elementIcon material-symbols-outlined"}>folder</td>
                                    <td class={"elementName"}>{item.name}</td>
                                </tr>
                            )
                        }
                        else if(item.type === "file"){
                            return (
                                <tr class={"element" + (selected.has(index) ? " selected" : "")} onDblClick={() => downloadFile(index)} onClick={(e) => selectFile(e,index)}>
                                    <td class={"elementIcon"}>
                                        <img src={"/gitCloud/file.svg"} alt={"file"} role={"img"} height={"21"}/>
                                    </td>
                                    <td class={"elementName"} >{item.name}</td>
                                    <td class={"elementSize"}>{item.byteSize}</td>
                                </tr>
                            )
                        }
                    })}
                    </tbody>
                </table>
            )
        }
    }, [elements, selected])

    const refreshData = async () => {
        try {
            const response = await fetch(new URL(apiUrl.current+"/lake/"+path.current), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'skip_zrok_interstitial': 'true'
                }
            })

            const lakeGet = await response.json() as gitCloudGetResponse;

            setInfo(null);
            setElements(lakeGet.entities);

            const dbCacheRequest = indexedDB.open("cache", 1)
            dbCacheRequest.onsuccess = () =>{
                const db = dbCacheRequest.result;
                const objectStore = db.transaction("entityList", "readwrite").objectStore("entityList");
                objectStore.put({path: path.current, entities: lakeGet.entities})
            }
        }catch (error){
            if(!(error instanceof Error)){
                setInfo("Unknown fetch error");
                return;
            }
            if(error.message === "Failed to fetch"){
                setInfo("Couldn't connect to the server");

                const dbCacheRequest = indexedDB.open("cache", 1)
                dbCacheRequest.onsuccess = () =>{
                    const db = dbCacheRequest.result;
                    const objectStore = db.transaction("entityList", "readwrite").objectStore("entityList");
                    objectStore.put({path: path.current, entities: []})
                }
                return;
            }
            setInfo("Failed to fetch data");
        }
    }
    const refreshDataFromCache = () => {
        const dbCacheRequest = indexedDB.open("cache", 1)
        dbCacheRequest.onsuccess = () =>{
            const getQuery = dbCacheRequest.result
                .transaction("entityList", "readonly")
                .objectStore("entityList")
                .get(path.current)
            getQuery.onsuccess = () => {
               setElements((getQuery.result as {path: string, entities: gitCloudGetResponse[]}).entities);
            }
        }
    }
    const setPath = (newPath: string) => {
        path.current = newPath;
        let query = new URLSearchParams(window.location.search)
        query.set("q", path.current)

        let url = new URL(window.location.href).search = "?" + query.toString()
        window.history.pushState(null, "", url)
    }
    const changePath = async( index: number) =>{

        let queryPath = new URLSearchParams(window.location.search).get("q") ?? ""

        if(queryPath.length === 0 || queryPath.endsWith("/")){
            path.current = queryPath + elements[index].name
        }else{
            path.current = queryPath + "/" + elements[index].name
        }
        await refreshData()
        setSelected(new Set<number>())
    }
    const downloadFile = async (index: number) =>{
        const link = document.createElement("a");
        if(path.current.length === 0 || path.current.endsWith("/")){
            link.href = apiUrl.current+"/lake/"+ path.current + elements[index].name;
        }else{
            link.href = apiUrl.current+"/lake/"+ path.current + "/" + elements[index].name;
        }
        link.download = elements[index].name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    const selectFile = (e :TargetedMouseEvent<HTMLTableRowElement> ,index: number) =>{
        if(e.ctrlKey){
            gcLog.info("ctrl")
            setSelected(new Set(selected.add(index)))
            return;
        }
        setSelected(new Set<number>([index]))
    }
    const deleteFile = () => {
        if(selected.size == 0){
            gcLog.error("No files selected")
        }
        const accessToken = 'Bearer ' + localStorage.getItem("accessToken")
        selected.forEach((item,index)=>{
            fetch(apiUrl.current + "/lake/" + path.current + "/" + elements[item].name, {
                method: "DELETE",
                headers:{
                    'skip_zrok_interstitial': 'true',
                    'Authorization': accessToken
                }
            }).then((resp) => {
                if(resp.status == 200){
                    gcLog.info("File " + elements[item].name + " deleted")
                    const tmpElements = elements
                    tmpElements.splice(item,1)
                    console.log(tmpElements)
                    setElements([...tmpElements])
                    return
                }
                gcLog.error("Error while deleting file " + elements[item].name, "Response code: " + resp.status);
            })
        })
    }

    useLayoutEffect( () => {

        const loginSuccess = () => {
            setLogin(true)
        }

        window.addEventListener("loginSuccess", loginSuccess);

        if(sessionStorage.getItem("loginSuccess") !== null){
            loginSuccess()
        }

        (async () => {
            //? cached elements
            if(await indexedDB.databases().then(dbsInfo => dbsInfo.some(value => value.name === "cache"))){
                refreshDataFromCache();
            }else{
                const dbCacheRequest = indexedDB.open("cache", 1)
                dbCacheRequest.onupgradeneeded = () =>{
                    const db = dbCacheRequest.result;
                    db.createObjectStore("entityList", {keyPath: "path", autoIncrement: false});
                }
            }
        })()

        const box = document.querySelector('.path');
        if(box) {
            box.scrollLeft = box.scrollWidth;
        }

    }, []);

    useEffect( () => {(async () => {
        await refreshData()
        window.addEventListener("refreshExplorer", refreshData);
        window.addEventListener("popstate", async () => {
            path.current = new URLSearchParams(window.location.search).get("q") ?? "";
            refreshDataFromCache();
        })
        if (localStorage.getItem("apiUrl") === null){
            localStorage.setItem("apiUrl", defaultServerAddress)
        }
    })()}, [])

    useEffect(() => {
        let query = new URLSearchParams(window.location.search)
        query.set("q", path.current)

        let url = new URL(window.location.href).search = "?" + query.toString()
        window.history.pushState(null, "", url)
    }, [elements]);

    const explorerContentRender = () => {
        return (
            <>
                <div class={"explorerOptions"}>
                    {login && <>
                        <div class={"tools"}>
                            <div class={"tool"} onClick={deleteFile} >Delete</div>
                            <div class={"tool"} style={{alignSelf: "flex-end"}}>tool2</div>
                        </div>
                        <NewFileComponent/>
                    </>}
                </div>
                <div class={"pathBar"}>
                    <button class={"refreshButton material-symbols-outlined"} onClick={async() => await refreshData()}>refresh</button>
                    <div class={"path"}>
                        <button class={"pathBlock"} onClick={async () => {
                            setPath("");
                            await refreshData();
                        }}>/</button>
                        {(() => {
                                const pathSplit = path.current.split("/");
                                if(pathSplit[0].length === 0){return null}
                                return pathSplit.map((pathChunk, index) => {
                                    return (
                                        <button class={"pathBlock"} onClick={async () => {
                                            setPath(pathSplit.slice(0, index).join("/"));
                                            await refreshData();
                                        }}>{pathChunk}</button>
                                    )})
                            })()
                        }
                    </div>
                </div>
                {elementsRendered}
            </>
        );
    }

    return (
        <div id={"explorer"}>
            {explorerContentRender()}
        </div>
    );
}
