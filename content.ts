/**
 *  memo:
 *      video:
 *          videoWidth/videoHeight: 解像度
 *          getBoundingClientRect:  表示サイズ
 *      
 *      canvas:
 *          width/height:       解像度
 *          style.width/height: 表示サイズ
 * 
 *  todo:
 *      5回以上delayMovingが実行された時の確認
 * 
 */

function getHead() {
    return `<style>
    html, body {
        margin: 0;
        width: fit-content;
        height: fit-content;
    }
    body {
        display: flex;
        flex-direction: column;
    }
    video {
        width: 100%;
        z-index: 1;
        position: absolute;
    }
    canvas {
        width: 100%;
        z-index: 2;
        position: absolute;
    }
    input {
        width: 100%;    
    }
    #playerframe {
        display: flex;
        justify-content: center;
    }
    #player {
        background: black;
        display: flex;
        flex-direction: column;
        width: fit-content;
        position: relative;
    }
    #ctrler {
        width: 100%;
        display: flex;
        flex-direction: row;
        align-items: center;
        background: ivory;
        justify-content: space-between;
    }
    #vtimer {
        white-space: pre;
        font-family: monospace;
    }
    .ctrl-rightside {
        justfy-content: end;
    }
</style>`;
}

function getBody() {
    return `<div id="playerframe">
    <div id="player"></div>
</div>
<div id="ctrler">
    <button id="ply-ps" class="ctrlbtn">Pause</button>
    <div    id="vtimer">00:00 / 00:00</div>
    <input  id="slider" type="range" max="10000" min="0" value="0"/>
    <button id="closer" class="ctrl-rightside">Close</button>
    <button id="fitter" class="ctrl-rightside">Fit</button>
</div>`;
}

interface DPiP extends EventTarget {
    window: Window;
    requestWindow() : Promise<Window>;
    requestWindow(option?: {
        disallowReturnToOpener?: boolean | null,
        height?: number | null,
        preferInitialWindowPlacement?: boolean | null,
        width?: number | null
    } | null) : Promise<Window>;
};

interface Size {
    width: number,
    height: number
};

function makeSize(width: number, height: number): Size {
    return { width: width, height: height };
}

function hasVideo(elem: HTMLElement): boolean {
    return Array.from(elem.querySelectorAll("video")).length !== 0;
}

function makeInscribed(size: Size, aspect: number): Size {
    if ((size.width / size.height) >= aspect) {
        return { width: size.height * aspect, height: size.height };
    } else {
        return { width: size.width, height: size.width / aspect };
    }
}

function resizeInscribed(size: Size, aspect: number, target: CSSStyleProperties): Size {
    const sizeto = makeInscribed(size, aspect);

    target.width = sizeto.width + "px";
    target.height = sizeto.height + "px";

    return sizeto;
}

function resizeWindow(video: HTMLVideoElement, canvas: HTMLCanvasElement | null, window: Window): void {  
    const ctrlRect = getCtrler(window).getBoundingClientRect();
    const ww = window.innerWidth;
    const wh = window.innerHeight - ctrlRect.height;

    const vAspect = video.videoWidth / video.videoHeight;

    if (canvas) {
        const cw = canvas.width;
        const ch = canvas.height;

        const cAspect = cw / ch;

        const csizeto = resizeInscribed(makeSize(ww, wh), cAspect, canvas.style);

        const vsizeto = resizeInscribed(csizeto, vAspect, video.style);

        const padx = (canvas.clientWidth - video.clientWidth) / 2;
        const pady = (canvas.clientHeight - video.clientHeight) / 2;

        video.style.left = padx + "px";
        video.style.top = pady + "px";

        const player = video.parentElement;
        if (player) {
            player.style.width = canvas.style.width;
            player.style.height = canvas.style.height;
        }

    } else {
        const sizeto = resizeInscribed(makeSize(ww, wh), vAspect, video.style);
    }
}

function getCtrler(window: Window): HTMLElement {
    return window.document.getElementById("ctrler") || window.document.body;
}

function formatTime(sec: number): string {
    let f02d = (s: number): string => {
        if (s < 10) {
            return "0" + Math.floor(s);
        } else {
            return String(Math.floor(s));
        }
    };
    let time = sec;
    const s = time % 60;
    time -= s;
    time /= 60;

    if (time < 1) {
        return "00:" + f02d(s);
    }

    const m = time % 60;
    time -= m;
    time /= 60;

    if (time < 1) {
        return f02d(m) + ":" + f02d(s);
    }

    const h = time % 60;
    
    return Math.floor(h) + ":" + f02d(m) + ":" + f02d(s);
}

function filterCommentCanvas(node: Node): boolean {
    return (
        node instanceof HTMLCanvasElement
        && node.parentElement?.dataset.name === "comment"
    );
}

(async () => {
    /**
     * Require construct after built PiP window and got video.
     */
    class VideoEventsHandler {
        private m_video: HTMLVideoElement;
        private m_timer: HTMLElement;
        private m_slider: HTMLInputElement;
        private m_pltps: HTMLButtonElement;
        private strCurrentTime: string = "00:00";
        private strDuration: string = "00:00";
        private beforeTime: number = -1;

        constructor(video: HTMLVideoElement, window: Window) {
            video.addEventListener("timeupdate", this.callback_timer);
            video.addEventListener("timeupdate", this.callback_slider);
            video.addEventListener("durationchange", this.callback_duration_changed);
            video.addEventListener("play", this.callback_onPlay);
            video.addEventListener("pause", this.callback_onPause);
            this.m_video = video;
            this.m_timer = window.document.getElementById("vtimer") as HTMLElement;
            this.m_slider = window.document.getElementById("slider") as HTMLInputElement;
            this.m_pltps = window.document.getElementById("ply-ps") as HTMLButtonElement;
            this.strDuration = formatTime(video.duration);
            this.callback_timer(new Event("create"));
        }

        /**
        * releaseEvents
        */
        public releaseEvents() {
            this.m_video.removeEventListener("timeupdate", this.callback_timer);
            this.m_video.removeEventListener("timeupdate", this.callback_slider);
            this.m_video.removeEventListener("durationchange", this.callback_duration_changed);
            this.m_video.removeEventListener("play", this.callback_onPlay);
            this.m_video.removeEventListener("pause", this.callback_onPause);
        }

        private callback_timer = (event: Event) => {
            const floored = Math.floor(this.m_video.currentTime);
            if (floored === this.beforeTime) {
                return;
            }
            this.beforeTime = floored;
            this.strCurrentTime = formatTime(floored);
            this.m_timer.innerText = `${this.strCurrentTime} / ${this.strDuration}`;
        };

        private callback_slider = (event: Event) => {
            this.m_slider.value = String(this.m_video.currentTime / (this.m_video.duration / 10000));
        };

        private callback_duration_changed = (event: Event) => {
            this.strDuration = formatTime(this.m_video.duration);
        };

        private callback_onPlay = (event: Event) => {
            this.m_pltps.innerText = "Pause";
        };

        private callback_onPause = (event: Event) => {
            this.m_pltps.innerText = "Play";
        };
    };

    class Ctrl {
        private m_window: Window;
        private m_video: HTMLVideoElement | null;
        private m_play_pause: HTMLButtonElement | null = null;
        private m_video_slider: HTMLInputElement | null = null;
        private m_video_fitter: HTMLButtonElement | null = null;
        private m_window_closer: HTMLButtonElement | null = null;

        constructor(window_: Window, video: HTMLVideoElement | null = null) {
            this.m_window = window_;
            this.m_video = video;

            const doc = window_.document;

            this.m_play_pause = doc.getElementById("ply-ps") as HTMLButtonElement | null;
            this.m_video_slider = doc.getElementById("slider") as HTMLInputElement | null;
            this.m_video_fitter = doc.getElementById("fitter") as HTMLButtonElement | null;
            this.m_window_closer = doc.getElementById("closer") as HTMLButtonElement | null;

            this.m_play_pause?.addEventListener("pointerup", this.onPlayPauseClicked);
            this.m_video_slider?.addEventListener("input", this.onSeek);
            this.m_video_fitter?.addEventListener("pointerup", this.onClickFit);
            this.m_window_closer?.addEventListener("pointerup", this.onClose);

            this.updateElements();
        }
    
        isValid(): boolean {
            return Boolean(this.m_video && this.m_play_pause && this.m_video_slider && this.m_video_fitter && this.m_window_closer);
        }

        updateVideo(video: HTMLVideoElement) {
            this.m_video = video;
            this.updateElements();
        }

        releaseVideo() {
            this.m_video = null;
        }

        private updateElements() {
            if (!this.m_video) return;

            if (this.m_play_pause) {
                this.m_play_pause.innerText = this.m_video.paused ? "Play" : "Pause";
            }

            if (this.m_video_slider) {
                this.m_video_slider.value = String(this.m_video.currentTime * 10000 / this.m_video.duration);
            }
        }

        private onPlayPauseClicked = async (event: Event) => {
            if (!this.m_video) return;
            
            if (!this.m_play_pause) { return ;}
            if (this.m_video.paused) {
                await this.m_video.play();
                this.m_play_pause.innerText = "Pause";
            } else {
                this.m_video.pause();
                this.m_play_pause.innerText = "Play";
            }
        };

        private onClose = (event: Event) => {
            this.m_window.close();
            // window.focus();
        };

        private onClickFit = () => {
            if (!this.m_video_fitter) return;
            const doc = this.m_window.document;
            const fitter = this.m_video_fitter;

            const difw = this.m_window.outerWidth - this.m_window.innerWidth;
            const difh = this.m_window.outerHeight - this.m_window.innerHeight;

            const width = doc.body.clientWidth + difw;
            const height = doc.body.clientHeight + difh;

            fitter.disabled = true;

            try {
                this.m_window.resizeTo(width, height);
            } catch (err) {
                console.log("Failed to resize PiP window.\n", err);
                fitter.style.background = "red";
            } finally {
                setTimeout(() => {
                    fitter.disabled = false;
                    fitter.style.background = "";
                }, 250);
            }   
        };

        private onSeek = () => {
            if (!this.m_video || !this.m_video_slider) return;
            this.m_video.currentTime = (this.m_video.duration / 10000) * Number(this.m_video_slider.value);
        }
    };

    interface AttrWrappedElement {
        width: string
        height: string
    };

    interface AttrWrappedVideo extends AttrWrappedElement {
        left: string
        top: string
    };

    interface AttrWrappedCanvas extends AttrWrappedElement {
        innerWidth: number,
        innerHeight: number
    };

    abstract class ElementWrapper<E extends Element> {
        protected m_elem: E | null;
        protected m_dst: Node;
        protected m_placeholder: Comment;
        protected m_isMoved: boolean;

        protected getPlaceholderData(): string {
            return "placeholder";
        }

        constructor(dstNode: Node) {
            this.m_elem = null;
            this.m_dst = dstNode;
            this.m_placeholder = document.createComment(this.getPlaceholderData());
            this.m_isMoved = false;
        }

        get element(): E | null {
            return this.m_elem;
        }

        public isMoved(): boolean {
            return this.m_isMoved;
        }

        protected abstract beforePull(): void;
        protected abstract beforePush(): void;
        protected abstract fillter(e: NodeListOf<E>): E | null;
        public abstract loadElement(): E | null;

        public pull() {
            if (!this.m_elem) return;

            const parent = this.m_elem.parentNode;
            
            if (!parent) {
                return;
            }

            this.beforePull();

            parent.insertBefore(this.m_placeholder, this.m_elem);
            this.m_dst.appendChild(this.m_elem);

            this.m_isMoved = true;
        }

        public push() {
            if (!this.m_elem) return;

            const parent = this.m_placeholder.parentNode;

            this.beforePush();

            if (parent) {
                parent.insertBefore(this.m_elem, this.m_placeholder);
                parent.removeChild(this.m_placeholder);
            }

            this.m_isMoved = false;
            this.m_elem = null;
        }
    };

    class WrappedVideo extends ElementWrapper<HTMLVideoElement> {
        private m_oldAttr: AttrWrappedVideo | null;
        private m_thumbnail: HTMLImageElement;

        constructor(dst: Node) {
            super(dst);
            this.m_oldAttr = this.storeAttr();
            this.m_thumbnail = document.createElement("img");
        }

        protected override fillter(e: NodeListOf<HTMLVideoElement>): HTMLVideoElement {
            e.forEach(v => {
                if (v.parentElement?.dataset.name === "video-content") return v;
            });
            return e.item(0);
        }

        public override loadElement() {
            if (this.m_elem && this.m_isMoved) {
                this.push();
            }
            const elems = document.querySelectorAll("video");
            if (elems.length === 0) {
                return null;
            }
            return this.m_elem = this.fillter(elems);
        }

        private storeAttr(): AttrWrappedVideo | null {
            if (!this.m_elem) return null;
            return this.m_oldAttr = {
                width: this.m_elem.style.width,
                height: this.m_elem.style.height,
                left: this.m_elem.style.left,
                top: this.m_elem.style.top
            };
        }

        private restoreAttr() {
            if (!this.m_elem || !this.m_oldAttr) return;
            const style = this.m_elem.style;
            style.width = this.m_oldAttr.width;
            style.height = this.m_oldAttr.height;
            style.left = this.m_oldAttr.left;
            style.top = this.m_oldAttr.top;
        }

        protected override beforePull(): void {
            if (!this.m_elem) return;
            this.storeAttr();
            const parent = this.m_elem.parentNode;
            if (!parent) {
                return;
            }
            this.m_thumbnail.src = this.m_elem.poster;
            parent.insertBefore(this.m_thumbnail, this.m_elem);
        }

        protected override beforePush(): void {
            if (!this.m_elem) return;
            this.restoreAttr();
            const parent = this.m_placeholder.parentNode;
            if (!parent) {
                return;
            }
            parent.removeChild(this.m_thumbnail);
        }
    };

    class WrappedCanvas extends ElementWrapper<HTMLCanvasElement> {
        private m_oldAttr: AttrWrappedCanvas | null;

        constructor(dstNode: Node) {
            super(dstNode);
            this.m_oldAttr = this.storeAttr();
        }

        private storeAttr(): AttrWrappedCanvas | null {
            if (!this.m_elem) return null;
            return this.m_oldAttr = {
                width: this.m_elem.style.width,
                height: this.m_elem.style.height,
                innerWidth: this.m_elem.width,
                innerHeight: this.m_elem.height
            };
        }

        private restoreAttr(): void {
            if (!this.m_elem || !this.m_oldAttr) return;
            const style = this.m_elem.style;
            style.width = this.m_oldAttr.width;
            style.height = this.m_oldAttr.height;
            this.m_elem.width = this.m_oldAttr.innerWidth;
            this.m_elem.height = this.m_oldAttr.innerHeight;
        }

        protected override beforePull(): void {
            this.storeAttr();
        }

        protected override beforePush(): void {
            this.restoreAttr();
        }

        protected override fillter(e: NodeListOf<HTMLCanvasElement>): HTMLCanvasElement | null {
            let target = null;
            e.forEach(c => {
                if (c.parentElement?.dataset.name === "comment") {
                    // console.log(c.cloneNode(), "is comment.");
                    target = c;
                }
                // console.log(c.cloneNode(), "is not comment.");
            });
            return target;
        }

        public override loadElement(): HTMLCanvasElement | null {
            if (this.m_elem && this.m_isMoved) {
                this.push();
            }
            const canvases = document.querySelectorAll("canvas");
            if (canvases.length === 0) {
                return null;
            }
            return this.m_elem = this.fillter(canvases);
        }
    };

    class WrappedHandler {
        private m_window: Window;
        private m_handler: VideoEventsHandler | null = null;
        constructor(w: Window) {
            this.m_window = w;
        }
        public updateHandler(v: HTMLVideoElement) {
            this.m_handler = new VideoEventsHandler(v, this.m_window);
        }
        public release() {
            this.m_handler?.releaseEvents();
            this.m_handler = null;
        }
    };

    let time: number | null = null;

    class MutationHandler {
        private modifiedAttrs: string[] = [];

        constructor(
            private w: Window,
            private v: WrappedVideo, 
            private c: WrappedCanvas,
            private ctrl: Ctrl,
            private h: WrappedHandler
        ) {}

        // restore contents when <title> changed.
        public onModifiedCharData(r: MutationRecord) {
            if (r.target.parentNode instanceof HTMLTitleElement) {
                console.log(`characterData <title>`);
                restoreContents(this.v, this.c, this.h, this.ctrl);
            }
        }

        // store comment canvas when width and height modified.
        public onModifiedAttrs(r: MutationRecord) {
            if (filterCommentCanvas(r.target)) {

                console.log(`attributes <canvas>`);
                this.modifiedAttrs.push(r.attributeName || "");

                if (this.modifiedAttrs.includes("width") && this.modifiedAttrs.includes("height")) {
                    console.log(`attr modified: `, r.target.cloneNode(true));
                    storeCanvas(this.c);

                    dbg.onCommentLoaded();

                    if (this.v.element)
                        resizeWindow(this.v.element, this.c.element, this.w);

                    this.modifiedAttrs = [];
                }
            }
        }

        // store video when <div id="stage"> added.
        public onModifiedTree(r: MutationRecord) {
            for (const node of r.addedNodes) {
                if (node instanceof HTMLDivElement && node.dataset.name === "stage") {
                    console.log(`childList <div data-name="stage"> `, node.cloneNode(true));

                    if (!storeVideo(this.v, this.h, this.ctrl)) {
                        this.w.close();
                        window.focus();
                        return;
                    }

                    if (this.v.element)
                        resizeWindow(this.v.element, this.c.element, this.w);
                }
            }
            for (const node of r.removedNodes) {
                if (node instanceof HTMLDivElement && node.dataset.name === "stage") {
                    console.log("removed stage");
                    dbg.setT1();
                }
            }
        }

        private dbgTimer: number | null = null;
    };

    interface dbgdata {
        t0?: number | null,
        t1?: number | null,
        deltat?: number | null
        result?: boolean | null,
        didLink?: boolean | null,
        title?: string | null,
        url?: string | null
    };

    class CommentDbger {
        private m_v: HTMLVideoElement | null = null;
        private m_c: HTMLCanvasElement | null = null;
        private m_t0: number | null = null;
        private m_t1: number | null = null;
        private m_result: boolean | null = null;
        private m_clicked: boolean | null = null;
        private m_results: dbgdata[] = [];
        public updateVideo(v: HTMLVideoElement) {
            const onPlay = () => {
                this.stop();
                v.removeEventListener("play", onPlay);
            };

            v.addEventListener("play", onPlay);
        }

        public onCommentLoaded() {
            this.m_result = true;
        }

        public onLinkClicked() {
            this.m_clicked = true;
        }

        public stop() {
            // this.m_results.push({ result: this.m_result, time: this.m_time })
            this.m_results.push({
                t0: this.m_t0,
                t1: this.m_t1,
                deltat: (this.m_t1 && this.m_t0) ? (this.m_t1 - this.m_t0) : null,
                result: this.m_result,
                didLink: this.m_clicked,
                title: document.title,
                url: document.URL
            });

            this.m_t0 = null;
            this.m_t1 = null;
            this.m_result = null;
            this.m_clicked = null;
        }

        public append(k: keyof dbgdata, value: any) {

        }

        public setT0() {
            this.m_t0 = performance.now();
        }

        public setT1() {
            this.m_t1 = performance.now();
        }

        public show() {
            console.log(this.m_results);
        }
    };

    const dbg = new CommentDbger();

    try {
        // support check
        if (!("documentPictureInPicture" in window)) {
            console.warn("documentPicutureInPicture not supported.");
            return;
        }

        const dpip = window.documentPictureInPicture as DPiP;
        const pipWin = dpip.window || await dpip.requestWindow({ width: 480, height: 270 });

        const doc = pipWin.document;

        if (hasVideo(doc.body)) {
            console.log("Already launched PiP.");
            return;
        }

        if (!doc.body.hasChildNodes()) {
            doc.head.innerHTML = getHead();

            doc.body.innerHTML = getBody();
        }

        const player = pipWin.document.querySelector("div#player") || pipWin.document;

        const cVideo = new WrappedVideo(player);
        const cCanvas = new WrappedCanvas(player);
        const ctrl = new Ctrl(pipWin);
        const cHandler = new WrappedHandler(pipWin);

        let result = storeContents(cVideo, cCanvas, cHandler, ctrl);
        if (!result || !cVideo.element) {
            console.log("Couldn't find videos.");
            return;
        }

        resizeWindow(cVideo.element, cCanvas.element, pipWin);

        const mh = new MutationHandler(pipWin, cVideo, cCanvas, ctrl, cHandler);

        const observer = new MutationObserver((records) => {
            for (const record of records) {
                switch (record.type) {
                    case "attributes": {
                        mh.onModifiedAttrs(record);
                        break;
                    }
                    case "characterData": {
                        mh.onModifiedCharData(record);
                        break;
                    }
                    case "childList": {
                        mh.onModifiedTree(record);
                        break;
                    }
                }
            }
        });
        observer.observe(document, { childList: true, subtree: true, attributes: true, attributeOldValue: true, characterData: true });

        document.addEventListener("pointerup", (e) => {
            if (e.target instanceof HTMLElement) {
                const link = e.target.getAttribute("href");
                if (link) {
                    console.log("detected pointerup on ", e.target);
                    dbg.onLinkClicked();
                    restoreContents(cVideo, cCanvas, cHandler, ctrl);
                }
            }
        });

        pipWin.addEventListener("pagehide", () => {
            observer.disconnect();
            restoreContents(cVideo, cCanvas, cHandler, ctrl);
            dbg.show();
            window.focus();
        });

        pipWin.addEventListener("resize", () => {
            if (cVideo.element)
                resizeWindow(cVideo.element, cCanvas.element, pipWin);
        });
        
    } catch (e) {
        console.error(e);
    }

    /**
     * 
     * @param v 
     * @param h 
     * @param ctrl 
     * @returns Boolean of found videos.
     */
    function storeVideo(v: WrappedVideo, h: WrappedHandler, ctrl: Ctrl): boolean {
        if (!v.loadElement() || !v.element) return false;

        dbg.updateVideo(v.element);

        v.pull();
        h.updateHandler(v.element);
        ctrl.updateVideo(v.element);
        
        return true;
    }

    function storeCanvas(c: WrappedCanvas) {
        c.loadElement();
        c.pull();
    }

    /**
     * 
     * @param v 
     * @param c 
     * @param h 
     * @param ctrl 
     * @returns Boolean of found videos.
     */
    function storeContents(
        v: WrappedVideo, 
        c: WrappedCanvas, 
        h: WrappedHandler,
        ctrl: Ctrl
    ): boolean {
        if (!storeVideo(v, h, ctrl)) return false;
        storeCanvas(c);
        return true;
    }

    function restoreVideo(v: WrappedVideo, h: WrappedHandler, ctrl: Ctrl) {
        h.release();
        ctrl.releaseVideo();
        v.push();
    }

    function restoreCanvas(c: WrappedCanvas) {
        c.push();
    }

    function restoreContents(
        v: WrappedVideo, 
        c: WrappedCanvas, 
        h: WrappedHandler, 
        ctrl: Ctrl
    ) {
        console.log("restoreContents");
        dbg.setT0();
        restoreVideo(v, h, ctrl);
        restoreCanvas(c);
    }
})();
