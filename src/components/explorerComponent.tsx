import {useEffect, useLayoutEffect, useRef, useState} from "preact/hooks";
import type {ComponentChildren} from "preact";
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

    const [elements, setElements] = useState<gitCloudGetResponse[]>([])

    const [info, setInfo] = useState<ComponentChildren|null>(null);

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
        if(path.current.length === 0 || path.current.endsWith("/")){
            path.current = path.current + elements[index].name
        }else{
            path.current = path.current + "/" + elements[index].name
        }

        let query = new URLSearchParams(window.location.search)
        query.set("q", path.current)

        let url = new URL(window.location.href).search = "?" + query.toString()
        window.history.pushState(null, "", url)
        await refreshData()
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
    const explorerContentRender = () => {
        return (
            <>
                <div class={"explorerOptions"}>
                    <div class={"tools"}>
                        <div class={"tool"}>tool1</div>
                        <div class={"tool"} style={{alignSelf: "flex-end"}}>tool2</div>
                    </div>
                    <button class={"uploadFileButton"}>
                        <div class={"material-symbols-outlined"} style={{fontSize: "1.5em"}}>upload_file</div>
                        <span>Add File</span>
                    </button>
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
                {(() => {
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
                                <tbody>
                                {elements.map((item, index) => {
                                    if (item.type === "dir") {
                                        return(
                                            <tr class={"element"} onClick={() => changePath(index)}>
                                                <td class={"elementIcon material-symbols-outlined"}>folder</td>
                                                <td class={"elementName"}>{item.name}</td>
                                            </tr>
                                        )
                                    }
                                    else if(item.type === "file"){
                                        return (
                                            <tr class={"element"} onClick={() => downloadFile(index)}>
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
                })()}
            </>
        );
    }

    useLayoutEffect( () => {(async () => {
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

        //? path
        const savedPath: string|null = sessionStorage.getItem("path");
        if(savedPath){
            sessionStorage.setItem("path", savedPath)
        }else {
            sessionStorage.setItem("path", "")
        }

        const box = document.querySelector('.path');
        if(box) {
            box.scrollLeft = box.scrollWidth;
        }
    })()}, []);

    useEffect( () => {(async () => {
        await refreshData()
        window.addEventListener("refreshExplorer", refreshData);
        window.addEventListener("popstate", async () => {
            path.current = new URLSearchParams(window.location.search).get("q") ?? "";
            refreshDataFromCache();
        })
    })()}, [])


    return (
        <div id={"explorer"}>
            {explorerContentRender()}
        </div>
    );
}