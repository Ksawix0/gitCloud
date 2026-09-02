import {useEffect, useState} from "preact/hooks";

interface gitCloudGetResponse{
    type: string;
    name: string;
    byteSize: number;
    entities: gitCloudGetResponse[];
}


const defaultServerAddress = "https://localhost:5550"

export default function ExplorerComponent(){

    const [path, setPath] = useState<string>("");

    const [apiUrl, setApiUrl] = useState<string>(defaultServerAddress);

    const [elements, setElements] = useState<gitCloudGetResponse[]>([])

    const [error, setError] = useState<string|null>(null);

    const refreshData = async () => {
        try {
            const response = await fetch(apiUrl+"/lake/"+path, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            })

            const lakeGet = await response.json() as gitCloudGetResponse;

            setError(null);
            setElements(lakeGet.entities);

            const dbCacheRequest = indexedDB.open("cache", 1)
            dbCacheRequest.onsuccess = (event) =>{
                const db = dbCacheRequest.result;
                const objectStore = db.transaction("entityList", "readwrite").objectStore("entityList");
                objectStore.add({path: path, entities: lakeGet.entities})
            }

        }catch (error){
            if(!(error instanceof Error)){
                setError("Unknown fetch error");
                return;
            }
            if(error.cause){
                console.log((error.cause as Error).message)
            }
            if(error.message === "Failed to fetch"){
                setError("Couldn't connect to the server");
                return;
            }
            setError("Failed to fetch data");
        }
    }

    const explorerContentRender = () => {
        if(error !== null){
            return (
                <>
                    <p style={{textAlign: 'center'}}>{error}</p>
                </>
            );
        }else{
            return (
                <>
                    <div class={"explorerOptions"}>
                        <div class={"tool"}>tool1</div>
                        <div class={"tool"}>tool2</div>
                    </div>
                    <div class={"path"}></div>
                    <div class={"elementsInfo"}>
                        <div class={"elementName"}>Name</div>
                        <div class={"elementSize"}>Size</div>
                    </div>
                    <div class={"elements"}>
                        {elements.map((item, index) => {
                            if (item.type === "dir") {
                                return(
                                    <div class={"element"}>
                                        <div class={"elementName"}>{item.name}</div>
                                    </div>
                                )
                            }
                            else if(item.type === "file"){
                                return (
                                    <div class={"element"}>
                                        <div class={"elementName"}>{item.name}</div>
                                        <div class={"elementSize"}>{item.byteSize}</div>
                                    </div>
                                )
                            }
                        })}
                    </div>
                </>
            );
        }
    }

    useEffect( () => {(async () => {

        if(await indexedDB.databases().then(dbsInfo => dbsInfo.some(value => value.name === "cache"))){

        }else{
            const dbCacheRequest = indexedDB.open("cache", 1)
            dbCacheRequest.onupgradeneeded = (event) =>{
                const db = dbCacheRequest.result;
                const store = db.createObjectStore("entityList", {keyPath: "path", autoIncrement: false});
            }
        }

        //? apiUrl
        const storedApiUrl: string|null = localStorage.getItem("apiUrl")
        if(storedApiUrl === null){
            localStorage.setItem("apiUrl", defaultServerAddress);
        }else {
            setApiUrl(storedApiUrl);
        }

        //? path
        const savedPath: string|null = sessionStorage.getItem("path");
        if(savedPath){
            sessionStorage.setItem("path", savedPath)
        }else {
            sessionStorage.setItem("path", "")
        }

        await refreshData()
    })()}, [])

    return (
        <div id={"explorer"}>
            {explorerContentRender()}
        </div>
    );
}