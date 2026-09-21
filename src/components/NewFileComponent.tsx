import style from "../styles/newFileComponent.module.css"
import {useEffect, useLayoutEffect, useRef, useState} from "preact/hooks";
import {useSignal, useSignalEffect} from "@preact/signals"
import {gcLog} from "./logComponent.tsx";

const chunkSize = 3072;

export default function NewFileComponent() {

    const [uploadFileWindowOpen, setUploadFileWindowOpen] = useState<boolean>(false);

    const dropFieldRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pathInputRef = useRef<HTMLInputElement>(null);
    const pathRef = () =>{
        const query = new URLSearchParams(window.location.search).get("q")
        if(query?.length ?? 0 > 0){
            return "/" + new URLSearchParams(window.location.search).get("q")+"/"
        }
        return "/"
    }

    const fileSignal = useSignal<File|null>(null)

    const handleKeyUp = useRef((e:KeyboardEvent) =>{
        if(e.key === "Escape"){
            setUploadFileWindowOpen(false);
            fileSignal.value = null;
        }
    })

    const handleDropField = (e:DragEvent) => {
        if(e.dataTransfer === null){
            return;
        }
        if(![...e.dataTransfer.items].some((item) => item.kind === "file")){
            return;
        }
        e.preventDefault();
        fileSignal.value = e.dataTransfer.items[0].getAsFile()
    }

    const handleDropWindow = useRef((e: DragEvent) => {
        if(e.dataTransfer === null){
            return;
        }
        if ([...e.dataTransfer.items].some((item) => item.kind === "file")) {
            e.preventDefault();
        }
    })
    const handleDragOverWindow = useRef((e: DragEvent) => {
        if(e.dataTransfer === null){
            return;
        }
        if ([...e.dataTransfer.items].some((item) => item.kind === "file")) {
            e.preventDefault();
        }
    })

    const handleFileSelect = () => {
        if (fileInputRef.current === null || fileInputRef.current.files === null || pathInputRef.current === null){
            return;
        }
        fileSignal.value = fileInputRef.current.files[0];
    }

    const uploadFile = () => {
        if(fileSignal.value === null){
            gcLog.error("No file selected");
            return;
        }

        if(pathInputRef.current === null || pathInputRef.current.value.length === 0){
            gcLog.error("No remote path entered")
            return;
        }

        let offset = 0

        fetch(localStorage.getItem("apiUrl")+"/lake/"+(pathInputRef.current.value.trim().replaceAll(/^\/+|\/+$/g, "")), {
            method: "PUT",
            headers: {
                'skip_zrok_interstitial': 'true',
                'Authorization':'Bearer ' + localStorage.getItem("accessToken")
            },
            body: new ReadableStream({
                pull: async (controller: ReadableByteStreamController) => {
                    if(fileSignal.value == null){
                        gcLog.error("No file selected");
                        controller.error("No file selected");
                        return;
                    }

                    if(offset + chunkSize < fileSignal.value.size){
                        controller.enqueue(new TextEncoder().encode((await fileSignal.value.slice(offset, offset+chunkSize).bytes()).toBase64()))
                        offset += chunkSize;
                    }
                    else{
                        controller.enqueue(new TextEncoder().encode((await fileSignal.value.slice(offset).bytes()).toBase64()))
                        controller.close()
                    }
                },
                type: "bytes"
            }),
        // @ts-ignore
            duplex: 'half'
        }).then((resp) => {
            if(resp.status === 200 || resp.status === 201 || resp.status === 204){
                gcLog.info("Successfully uploaded file");
                window.dispatchEvent(new CustomEvent("refreshExplorer"))
            } else{
                gcLog.error("Failed to upload file, error code: " + resp.status);
            }
            fileSignal.value = null;
        })
    }

    useEffect(() => {
        if(uploadFileWindowOpen){
            window.addEventListener("keyup", handleKeyUp.current)

            window.addEventListener("drop", handleDropWindow.current);
            dropFieldRef.current?.addEventListener("drop", handleDropField)

            window.addEventListener("dragover", handleDragOverWindow.current);
            dropFieldRef.current?.addEventListener("dragover", (e) => {
                if(e.dataTransfer === null){
                    return;
                }
                if ([...e.dataTransfer.items].some((item) => item.kind === "file")) {
                    e.preventDefault();
                }
            });

        }else{
            window.removeEventListener("keyup", handleKeyUp.current)
            window.removeEventListener("drop", handleDropWindow.current)
            window.removeEventListener("dragover", handleDragOverWindow.current)
        }
    }, [uploadFileWindowOpen]);

    useSignalEffect(() => {
        if(fileSignal.value === null || pathInputRef.current === null){return;}
        pathInputRef.current.value = pathRef() + fileSignal.value.name;
    });

    const renderComponent = () => {
        return (
            <>
                <button class={"uploadFileButton"} onClick={() => setUploadFileWindowOpen(!uploadFileWindowOpen)}>
                    <div class={"material-symbols-outlined"} style={{fontSize: "1.5em"}}>upload_file</div>
                    <span>Upload File</span>
                </button>

                {uploadFileWindowOpen? (
                    <div class={style.newFileWindow}>
                        <div class={style.uploadFileWindow}>
                            <div class={style.uploadFileField} ref={dropFieldRef} onClick={() => fileInputRef.current?.click()}>
                                {fileSignal.value === null ? (
                                        <>
                                            <div class={"material-symbols-outlined"} style={{fontSize: "4rem"}}>add_circle</div>
                                            <div style={{padding: "1.2rem"}}>Drop file here, or click to upload</div>
                                        </>
                                    ) : (
                                        <>
                                            <div class={style.file}>
                                                <img src={"/gitCloud/file.svg"} alt={"file"} role={"img"} height={"auto"} style={{paddingBottom: "2rem", maxHeight: "60%"}}/>
                                                <div>{fileSignal.value.name}</div>
                                                <div>{"Size: " + fileSignal.value.size + " bytes"}</div>
                                            </div>
                                        </>
                                )}
                                <input type="file" style={{display: "none"}} ref={fileInputRef} onChange={handleFileSelect}/>
                            </div>
                            <div class={style.pathField}>
                                <div style={{margin: "1rem", fontSize: "1.2rem"}}>Remote path:</div>
                                <input class={style.pathInput} value={pathRef()} ref={pathInputRef}/>
                                <button class={style.uploadButton} onClick={uploadFile}>Upload</button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </>
        )
    }

    return renderComponent();
}