'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Layers, Pause, Play } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type SoundType = 'file' | 'playlist' | 'synth';

type SoundDef = {
    id: string;
    label: string;
    emoji: string;
    color: string;
    category: string;
    type: SoundType;
    src?: string;         // single file URL
    srcs?: string[];      // playlist (cycles through tracks)
};

type Layer = {
    gainNode: GainNode;
    stop: () => void;
};

// ── Audio proxy helper ──────────────────────────────────────────────────────
// Routes archive.org URLs through our own server to avoid CORS/redirect issues.
// The proxy streams the audio — no full download needed before playback.

function p(url: string): string {
    return `/api/proxy-audio?url=${encodeURIComponent(url)}`;
}

// ── Music playlists ─────────────────────────────────────────────────────────

const LOFI_TRACKS = [
    'https://archive.org/download/chill-lofi-music-relax-study/Nogymx%20-%20Mirage%20of%20the%20Mind.mp3',
    'https://archive.org/download/chill-lofi-music-relax-study/Ajmw%20-%20Heading%20Home.mp3',
    'https://archive.org/download/chill-lofi-music-relax-study/Casiio%20-%20Far%20Off.mp3',
    'https://archive.org/download/chill-lofi-music-relax-study/Kayou.%20-%20Until%20we%20meet%20again.mp3',
    'https://archive.org/download/chill-lofi-music-relax-study/S%C3%A1tyr%20x%20Phlocalyst%20-%20Aiode.mp3',
    'https://archive.org/download/chill-lofi-music-relax-study/Kinissue%20-%20Sea%20Beams.mp3',
    'https://archive.org/download/chill-lofi-music-relax-study/goodnyght%20-%20Sleep%20cycles.mp3',
    'https://archive.org/download/chill-lofi-music-relax-study/Tom%20Doolie%20-%20Land%20of%20Calm.mp3',
].map(p);

const JAZZ_TRACKS = [
    'https://archive.org/download/DWK127/Kova_-_01_-_From_Dusk_Till_Dawn_Part_1.mp3',
    'https://archive.org/download/DWK127/Kova_-_03_-_The_Werewolf.mp3',
    'https://archive.org/download/DWK127/Kova_-_05_-_I_Keep_Secrets.mp3',
    'https://archive.org/download/DWK119/Jenova_7_-_15_-_Inner_Space_feat._Hugo_Kant.mp3',
    'https://archive.org/download/DWK119/Jenova_7_-_03_-_Streetlight_Noir.mp3',
    'https://archive.org/download/DWK119/Jenova_7_-_18_-_Alleyway_Jazz.mp3',
    'https://archive.org/download/DWK217/Boogie_Belgique_-_15_-_Morning_Mist.mp3',
    'https://archive.org/download/DWK217/Boogie_Belgique_-_01_-_Forever_and_Ever.mp3',
    'https://archive.org/download/45rpm0392010NamelessDancers-RainCafe/01Nameless_Dancers_-_Voyage_In_The_Night.mp3',
    'https://archive.org/download/45rpm0392010NamelessDancers-RainCafe/05Nameless_Dancers_-_Sweet_Vine_LongMix.mp3',
].map(p);

const CLASSICAL_TRACKS = [
    'https://archive.org/download/musopen-chopin/Ballade%20no.%201%20-%20Op.%2023.mp3',
    'https://archive.org/download/musopen-chopin/Nocturne%20Op.%2048%20no.%202%20in%20F%20sharp%20minor.mp3',
    'https://archive.org/download/musopen-chopin/Fantasy%20Op.%2049%20in%20F%20minor.mp3',
    'https://archive.org/download/musopen-chopin/Ballade%20no.%204%20-%20Op.%2052.mp3',
    'https://archive.org/download/ErikSatie_201903/01%20Gnossiennes%20No.1.mp3',
    'https://archive.org/download/ErikSatie_201903/12%20Sarabandes%20No.1.mp3',
    'https://archive.org/download/24Preludes/PreludesBookIL117-10.LaCathedraleEngloutie.ProfondementCalme.mp3',
].map(p);

const AMBIENT_TRACKS = [
    'https://archive.org/download/laridae031/laridae031-03-iambic2_-_enigma.mp3',
    'https://archive.org/download/laridae031/laridae031-07-iambic2_-_going_home.mp3',
    'https://archive.org/download/laridae031/laridae031-11-iambic2_-_rain_drop.mp3',
    'https://archive.org/download/laridae031/laridae031-08-iambic2_-_now_we_re_mobile.mp3',
    'https://archive.org/download/Vkrsnl037CandlegravityAMomentForMyself/Candlegravity-AMomentForMyself-06-YouWereInMyDream.mp3',
    'https://archive.org/download/Vkrsnl037CandlegravityAMomentForMyself/Candlegravity-AMomentForMyself-05-DontSayGoodbye.mp3',
].map(p);

// ── File-based environment sounds (proxied) ─────────────────────────────────

const RAIN_URL  = p('https://archive.org/download/relaxingrainsounds/Light%20Gentle%20Rain%20Part%201.mp3');
const OCEAN_URL = p('https://archive.org/download/ocean-sea-sounds/Gentle%20Ocean.mp3');
const CAFE_URL  = p('https://archive.org/download/coffee-shop-sounds-12/Coffee%20Shop%20Sounds%2012.mp3');

// ── Categories & Sounds ────────────────────────────────────────────────────

const CATEGORIES = [
    { id: 'nature',  label: 'Nature',  emoji: '🌿' },
    { id: 'cozy',    label: 'Confort', emoji: '🔥' },
    { id: 'music',   label: 'Musique', emoji: '🎵' },
    { id: 'focus',   label: 'Focus',   emoji: '🎛️' },
];

const SOUNDS: SoundDef[] = [
    // ── Nature ──
    { id: 'rain',   label: 'Pluie',       emoji: '🌧️', color: '#60a5fa', category: 'nature', type: 'file',     src: RAIN_URL  },
    { id: 'storm',  label: 'Orage',       emoji: '⛈️', color: '#818cf8', category: 'nature', type: 'synth'                     },
    { id: 'ocean',  label: 'Océan',       emoji: '🌊', color: '#22d3ee', category: 'nature', type: 'file',     src: OCEAN_URL },
    { id: 'stream', label: 'Ruisseau',    emoji: '💧', color: '#34d399', category: 'nature', type: 'synth'                     },
    { id: 'forest', label: 'Forêt',       emoji: '🌲', color: '#4ade80', category: 'nature', type: 'synth'                     },
    { id: 'wind',   label: 'Vent',        emoji: '💨', color: '#a8a29e', category: 'nature', type: 'synth'                     },
    // ── Cozy ──
    { id: 'fire',   label: 'Feu de camp', emoji: '🔥', color: '#fb923c', category: 'cozy',   type: 'synth'                     },
    { id: 'cafe',   label: 'Café',        emoji: '☕', color: '#c8a960', category: 'cozy',   type: 'file',     src: CAFE_URL  },
    // ── Music ──
    { id: 'lofi',       label: 'Lo-fi',     emoji: '🎵', color: '#c084fc', category: 'music',  type: 'playlist', srcs: LOFI_TRACKS       },
    { id: 'jazz',       label: 'Jazz',       emoji: '🎷', color: '#fb923c', category: 'music',  type: 'playlist', srcs: JAZZ_TRACKS       },
    { id: 'classical',  label: 'Classique', emoji: '🎹', color: '#818cf8', category: 'music',  type: 'playlist', srcs: CLASSICAL_TRACKS  },
    { id: 'ambient',    label: 'Ambient',   emoji: '🌌', color: '#5eead4', category: 'music',  type: 'playlist', srcs: AMBIENT_TRACKS    },
    // ── Focus ──
    { id: 'white',  label: 'Bruit Blanc', emoji: '⚪', color: '#cbd5e1', category: 'focus',  type: 'synth'                     },
    { id: 'pink',   label: 'Bruit Rose',  emoji: '🌸', color: '#f472b6', category: 'focus',  type: 'synth'                     },
    { id: 'brown',  label: 'Bruit Brun',  emoji: '🟤', color: '#a78bfa', category: 'focus',  type: 'synth'                     },
];

// ── Noise buffer generation ────────────────────────────────────────────────
// 30-second stereo buffers — loop point takes 30 s to hit, barely audible.

function makeNoise(ctx: AudioContext, type: 'white' | 'pink' | 'brown', sec = 30): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        if (type === 'white') {
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        } else if (type === 'pink') {
            let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
            for (let i = 0; i < len; i++) {
                const w = Math.random() * 2 - 1;
                b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
                b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
                b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
                d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
            }
        } else {
            let last = 0;
            for (let i = 0; i < len; i++) {
                const w = Math.random() * 2 - 1;
                d[i] = (last + 0.02 * w) / 1.02; last = d[i]; d[i] *= 3.5;
            }
        }
    }
    return buf;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AmbientPlayer({ compact = false }: { compact?: boolean }) {
    const [activeVols, setActiveVols]         = useState<Record<string, number>>({});
    const [expanded, setExpanded]             = useState(!compact);
    const [activeCategory, setActiveCategory] = useState('nature');
    const [masterVol, setMasterVol]           = useState(0.7);
    const [paused, setPaused]                 = useState(false);

    const ctxRef      = useRef<AudioContext | null>(null);
    const masterRef   = useRef<GainNode | null>(null);
    const layersRef   = useRef<Record<string, Layer>>({});
    const timersRef   = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});
    const audiosRef   = useRef<Record<string, HTMLAudioElement>>({});
    // Lo-fi playlist state (track index per sound id)
    const playlistIdx = useRef<Record<string, number>>({});

    // ── Restore ──
    useEffect(() => {
        const saved = localStorage.getItem('brilliplan_ambient_v2');
        if (saved) {
            try {
                const { vols, cat, mv } = JSON.parse(saved);
                if (vols) setActiveVols(vols);
                if (cat) setActiveCategory(cat);
                if (typeof mv === 'number') setMasterVol(mv);
            } catch { /* ignore */ }
        }
        return () => {
            Object.values(layersRef.current).forEach(l => { try { l.stop(); l.gainNode.disconnect(); } catch {} });
            Object.values(audiosRef.current).forEach(a => { try { a.pause(); a.src = ''; } catch {} });
            Object.values(timersRef.current).forEach(ts => ts.forEach(clearTimeout));
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('brilliplan_ambient_v2', JSON.stringify({ vols: activeVols, cat: activeCategory, mv: masterVol }));
        const count = Object.values(activeVols).filter(v => v > 0).length;
        window.dispatchEvent(new CustomEvent('brilliplan-ambient-change', { detail: { count } }));
        // reset paused when all sounds are off
        if (count === 0) setPaused(false);
    }, [activeVols, activeCategory, masterVol]);

    useEffect(() => {
        if (masterRef.current && ctxRef.current) {
            masterRef.current.gain.setTargetAtTime(masterVol, ctxRef.current.currentTime, 0.1);
        }
    }, [masterVol]);

    // ── AudioContext ──
    function getCtx(): AudioContext {
        if (!ctxRef.current) {
            const Cls = window.AudioContext || (window as any).webkitAudioContext;
            ctxRef.current = new Cls();
            masterRef.current = ctxRef.current.createGain();
            masterRef.current.gain.value = masterVol;
            masterRef.current.connect(ctxRef.current.destination);
        }
        if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
        return ctxRef.current;
    }

    // ── Stop a layer with fade ──
    function stopLayer(id: string) {
        (timersRef.current[id] || []).forEach(clearTimeout);
        delete timersRef.current[id];

        const layer = layersRef.current[id];
        if (layer && ctxRef.current) {
            try { layer.gainNode.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.25); } catch {}
            setTimeout(() => {
                try { layer.stop(); } catch {}
                try { layer.gainNode.disconnect(); } catch {}
            }, 500);
            delete layersRef.current[id];
        }

        const audio = audiosRef.current[id];
        if (audio) {
            try { audio.pause(); audio.src = ''; } catch {}
            delete audiosRef.current[id];
        }
    }

    // ── File / playlist source ─────────────────────────────────────────────
    // Uses HTMLAudioElement (streaming — no full download needed).
    // On audio error, automatically falls back to Web Audio synthesis.

    function startFileSrc(id: string, src: string, vol: number, onEnded?: () => void) {
        const ctx = getCtx();

        const audio = new Audio(src);
        audio.crossOrigin = 'anonymous';
        audio.loop = !onEnded; // don't loop playlist tracks
        audiosRef.current[id] = audio;

        const gainNode = ctx.createGain();
        gainNode.gain.value = 0;
        gainNode.gain.setTargetAtTime(vol, ctx.currentTime, 0.6);
        gainNode.connect(masterRef.current!);

        let mediaNode: MediaElementAudioSourceNode | null = null;

        audio.onerror = () => {
            // Network/CORS error → fall back to synthesis
            try { audio.pause(); } catch {}
            if (mediaNode) { try { mediaNode.disconnect(); } catch {} }
            if (layersRef.current[id]) {
                layersRef.current[id] = {
                    gainNode,
                    stop: () => { try { gainNode.disconnect(); } catch {} },
                };
            }
            startSynth(id, vol, gainNode);
        };

        if (onEnded) audio.onended = onEnded;

        try {
            mediaNode = ctx.createMediaElementSource(audio);
            mediaNode.connect(gainNode);
        } catch (e) {
            // Fallback if createMediaElementSource fails
            startSynth(id, vol, gainNode);
            return;
        }

        audio.play().catch(() => startSynth(id, vol, gainNode));

        layersRef.current[id] = {
            gainNode,
            stop: () => {
                try { audio.pause(); audio.src = ''; } catch {}
                try { mediaNode?.disconnect(); } catch {}
            },
        };
    }

    // ── Playlist cycling (lo-fi) ───────────────────────────────────────────
    // Uses ONE persistent GainNode for the whole playlist lifetime.
    // Only the HTMLAudioElement + MediaElementSourceNode are swapped per track.

    function startPlaylist(id: string, srcs: string[], vol: number) {
        const ctx = getCtx();

        // Single gain node — persists across all tracks
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0;
        gainNode.gain.setTargetAtTime(vol, ctx.currentTime, 0.6);
        gainNode.connect(masterRef.current!);

        let currentAudio: HTMLAudioElement | null = null;
        let currentMedia: MediaElementAudioSourceNode | null = null;
        let stopped = false;
        let idx = playlistIdx.current[id] ?? 0;

        const playTrack = () => {
            if (stopped) return;

            // Teardown previous track's source (keep gainNode intact)
            if (currentAudio) {
                currentAudio.onended = null;
                currentAudio.onerror = null;
                try { currentAudio.pause(); currentAudio.src = ''; } catch {}
            }
            if (currentMedia) {
                try { currentMedia.disconnect(); } catch {}
                currentMedia = null;
            }

            const src = srcs[idx % srcs.length];
            idx = (idx + 1) % srcs.length;
            playlistIdx.current[id] = idx;

            const audio = new Audio(src);
            audio.crossOrigin = 'anonymous';
            audio.loop = false;
            currentAudio = audio;
            audiosRef.current[id] = audio;

            audio.onended  = () => { if (!stopped) playTrack(); };
            audio.onerror  = () => { if (!stopped) setTimeout(playTrack, 1500); };

            try {
                const media = ctx.createMediaElementSource(audio);
                media.connect(gainNode);
                currentMedia = media;
            } catch {
                // createMediaElementSource failed — fall back to synth
                startSynth(id, vol, gainNode);
                return;
            }

            audio.play().catch(() => { if (!stopped) setTimeout(playTrack, 2000); });
        };

        layersRef.current[id] = {
            gainNode,
            stop: () => {
                stopped = true;
                if (currentAudio) {
                    currentAudio.onended = null;
                    currentAudio.onerror = null;
                    try { currentAudio.pause(); currentAudio.src = ''; } catch {}
                }
                if (currentMedia) { try { currentMedia.disconnect(); } catch {} }
            },
        };

        playTrack();
    }

    // ── Synthesized sounds ─────────────────────────────────────────────────
    // All use large 30-second stereo buffers + dual overlapping sources at
    // different playback rates so loop points drift apart permanently.
    // Dynamic LFOs evolve on 30–100 second cycles for organic texture.

    function startSynth(id: string, vol: number, existingGain?: GainNode) {
        const ctx = getCtx();

        const layerGain = existingGain ?? ctx.createGain();
        if (!existingGain) {
            layerGain.gain.value = 0;
            layerGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.6);
            layerGain.connect(masterRef.current!);
        }

        const nodes: AudioNode[] = [];
        const timers: ReturnType<typeof setTimeout>[] = [];

        const mkSrc = (buf: AudioBuffer, rate = 1.0) => {
            const s = ctx.createBufferSource();
            s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
            return s;
        };
        const lp = (f: number, q = 0.7) => {
            const n = ctx.createBiquadFilter(); n.type = 'lowpass'; n.frequency.value = f; n.Q.value = q; return n;
        };
        const hp = (f: number, q = 0.7) => {
            const n = ctx.createBiquadFilter(); n.type = 'highpass'; n.frequency.value = f; n.Q.value = q; return n;
        };
        const gain = (v: number) => { const n = ctx.createGain(); n.gain.value = v; return n; };
        const lfo = (freq: number, amt: number, target: AudioParam) => {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
            const g = ctx.createGain(); g.gain.value = amt;
            o.connect(g); g.connect(target); o.start();
            return [o, g] as const;
        };

        // ── white / pink / brown ──
        if (id === 'white') {
            const s = mkSrc(makeNoise(ctx, 'white', 30));
            s.connect(layerGain); s.start(); nodes.push(s);

        } else if (id === 'pink') {
            const s = mkSrc(makeNoise(ctx, 'pink', 30));
            s.connect(layerGain); s.start(); nodes.push(s);

        } else if (id === 'brown') {
            const s = mkSrc(makeNoise(ctx, 'brown', 30));
            s.connect(layerGain); s.start(); nodes.push(s);

        // ── rain (synth fallback — also used when archive.org is unavailable) ──
        } else if (id === 'rain') {
            const buf = makeNoise(ctx, 'white', 30);
            const s1 = mkSrc(buf, 1.00); const f1lp = lp(1100); const f1hp = hp(320);
            const s2 = mkSrc(buf, 0.97); const f2lp = lp(850);  const f2hp = hp(480); const g2 = gain(0.55);
            const s3 = mkSrc(buf, 1.04); const f3lp = lp(600);  const f3hp = hp(600); const g3 = gain(0.3);
            s1.connect(f1lp); f1lp.connect(f1hp); f1hp.connect(layerGain);
            s2.connect(f2lp); f2lp.connect(f2hp); f2hp.connect(g2); g2.connect(layerGain);
            s3.connect(f3lp); f3lp.connect(f3hp); f3hp.connect(g3); g3.connect(layerGain);
            const [lo1] = lfo(0.022, 170, f1lp.frequency);
            s1.start(); s2.start(ctx.currentTime + 6); s3.start(ctx.currentTime + 13);
            nodes.push(s1,s2,s3,f1lp,f1hp,f2lp,f2hp,g2,f3lp,f3hp,g3,lo1);

        // ── storm ──
        } else if (id === 'storm') {
            const wBuf = makeNoise(ctx, 'white', 30);
            const bBuf = makeNoise(ctx, 'brown', 20);
            // Heavy rain
            const rS = mkSrc(wBuf); const rLp = lp(1800); const rHp = hp(200); const rG = gain(1.1);
            rS.connect(rLp); rLp.connect(rHp); rHp.connect(rG); rG.connect(layerGain); rS.start();
            // Rumble
            const ruS = mkSrc(bBuf, 0.4); const ruLp = lp(100); const ruG = gain(0.7);
            ruS.connect(ruLp); ruLp.connect(ruG); ruG.connect(layerGain); ruS.start();
            // Wind gust layer
            const wS = mkSrc(makeNoise(ctx, 'pink', 28), 0.95);
            const wBp = ctx.createBiquadFilter(); wBp.type = 'bandpass'; wBp.frequency.value = 350; wBp.Q.value = 1.2;
            const wG = gain(0.45);
            const [swLfo] = lfo(0.01, 280, wBp.frequency);
            wS.connect(wBp); wBp.connect(wG); wG.connect(layerGain); wS.start(ctx.currentTime + 2);
            // Random thunder
            const thunder = () => {
                const d = 12000 + Math.random() * 22000;
                const t = setTimeout(() => {
                    if (!layersRef.current[id] || !ctxRef.current) return;
                    const c = ctxRef.current;
                    const tb = makeNoise(c, 'brown', 1);
                    const ts = c.createBufferSource(); ts.buffer = tb;
                    const tf = lp(160); const tg = c.createGain();
                    tg.gain.setValueAtTime(0, c.currentTime);
                    tg.gain.linearRampToValueAtTime(1.1+Math.random()*0.9, c.currentTime+0.07);
                    tg.gain.exponentialRampToValueAtTime(0.001, c.currentTime+2.4);
                    ts.connect(tf); tf.connect(tg); tg.connect(masterRef.current!);
                    ts.start(); ts.stop(c.currentTime+2.5); thunder();
                }, d);
                timers.push(t);
            };
            thunder();
            nodes.push(rS,rLp,rHp,rG,ruS,ruLp,ruG,wS,wBp,wG,swLfo);

        // ── ocean (synth fallback) ──
        } else if (id === 'ocean') {
            // Multi-layer waves: slow swells + medium waves + surface texture
            const buf = makeNoise(ctx, 'white', 30);

            const mkWave = (rate: number, gv: number, lpFreq: number, lfoHz: number, lfoAmt: number) => {
                const s = mkSrc(buf, rate);
                const f = lp(lpFreq, 0.5);
                const g = gain(gv);
                const [lo] = lfo(lfoHz, lfoAmt, f.frequency);
                const ampLfo = ctx.createOscillator(); ampLfo.type = 'sine'; ampLfo.frequency.value = lfoHz * 0.8;
                const ampG = ctx.createGain(); ampG.gain.value = gv * 0.4;
                ampLfo.connect(ampG); ampG.connect(g.gain); ampLfo.start();
                s.connect(f); f.connect(g); g.connect(layerGain);
                return { s, f, g, lo, ampLfo, ampG };
            };

            const w1 = mkWave(0.30, 0.9,  220, 0.05, 140); // deep swells
            const w2 = mkWave(0.55, 0.7,  450, 0.10, 200); // regular waves
            const w3 = mkWave(0.85, 0.45, 700, 0.18, 180); // wave detail
            const spray = mkSrc(makeNoise(ctx, 'white', 20), 1.1);
            const sprayHp = hp(2000); const sprayG = gain(0.12);
            spray.connect(sprayHp); sprayHp.connect(sprayG); sprayG.connect(layerGain);

            w1.s.start(); w2.s.start(ctx.currentTime+4); w3.s.start(ctx.currentTime+9); spray.start(ctx.currentTime+2);
            nodes.push(w1.s,w1.f,w1.g,w1.lo,w1.ampLfo,w1.ampG,
                       w2.s,w2.f,w2.g,w2.lo,w2.ampLfo,w2.ampG,
                       w3.s,w3.f,w3.g,w3.lo,w3.ampLfo,w3.ampG,
                       spray,sprayHp,sprayG);

        // ── forest — wind + procedural bird chirps ──
        } else if (id === 'forest') {
            // Background wind/rustling
            const pBuf = makeNoise(ctx, 'pink', 30);
            const wS = mkSrc(pBuf, 0.93);
            const wBp = ctx.createBiquadFilter(); wBp.type = 'bandpass'; wBp.frequency.value = 300; wBp.Q.value = 1.0;
            const wLp2 = lp(1200); const wG = gain(0.55);
            const [swLfo] = lfo(0.015, 200, wBp.frequency);
            const [ampLfo] = lfo(0.09, 0.18, wG.gain);
            wS.connect(wBp); wBp.connect(wLp2); wLp2.connect(wG); wG.connect(layerGain); wS.start();
            nodes.push(wS,wBp,wLp2,wG,swLfo,ampLfo);

            // Procedural bird chirps — each species has distinct frequency range & pattern
            const BIRDS = [
                { freqA: 3200, freqB: 4200, dur: 0.12, reps: 2, gap: 0.08 }, // Robin-like
                { freqA: 2400, freqB: 3600, dur: 0.18, reps: 1, gap: 0,    }, // Warbler-like
                { freqA: 1800, freqB: 2600, dur: 0.3,  reps: 3, gap: 0.12 }, // Thrush-like
                { freqA: 4000, freqB: 5000, dur: 0.08, reps: 4, gap: 0.06 }, // Sparrow-like
            ];

            const chirpBird = (birdType: number) => {
                if (!layersRef.current[id] || !ctxRef.current) return;
                const c = ctxRef.current;
                const b = BIRDS[birdType];

                const sing = (rep: number) => {
                    if (!layersRef.current[id] || !ctxRef.current) return;
                    const osc = c.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(b.freqA, c.currentTime);
                    osc.frequency.linearRampToValueAtTime(b.freqB, c.currentTime + b.dur * 0.6);
                    osc.frequency.linearRampToValueAtTime(b.freqA * 0.9, c.currentTime + b.dur);
                    const eg = c.createGain();
                    eg.gain.setValueAtTime(0, c.currentTime);
                    eg.gain.linearRampToValueAtTime(0.04 + Math.random()*0.03, c.currentTime + b.dur*0.3);
                    eg.gain.exponentialRampToValueAtTime(0.001, c.currentTime + b.dur);
                    osc.connect(eg); eg.connect(masterRef.current!);
                    osc.start(); osc.stop(c.currentTime + b.dur + 0.01);

                    if (rep < b.reps - 1) {
                        const t = setTimeout(() => sing(rep + 1), (b.dur + b.gap) * 1000);
                        timers.push(t);
                    }
                };

                sing(0);

                // Schedule next call for this bird type
                const nextIn = 5000 + Math.random() * 25000;
                const t = setTimeout(() => chirpBird(birdType), nextIn);
                timers.push(t);
            };

            // Start each bird species at different initial delays
            BIRDS.forEach((_, i) => {
                const t = setTimeout(() => chirpBird(i), 1000 + i * 3500 + Math.random() * 4000);
                timers.push(t);
            });

        // ── stream ──
        } else if (id === 'stream') {
            const buf = makeNoise(ctx, 'white', 30);
            const s1 = mkSrc(buf, 1.00); const h1 = hp(600); const l1 = lp(3500); const g1 = gain(1.0);
            const s2 = mkSrc(buf, 1.05); const h2 = hp(900); const l2 = lp(2800); const g2 = gain(0.55);
            const [lo1] = lfo(2.8, 450, l1.frequency);
            const [lo2] = lfo(3.7, 380, l2.frequency);
            s1.connect(h1); h1.connect(l1); l1.connect(g1); g1.connect(layerGain);
            s2.connect(h2); h2.connect(l2); l2.connect(g2); g2.connect(layerGain);
            s1.start(); s2.start(ctx.currentTime + 3);
            nodes.push(s1,s2,h1,l1,g1,h2,l2,g2,lo1,lo2);

        // ── wind ──
        } else if (id === 'wind') {
            const buf1 = makeNoise(ctx, 'pink', 30);
            const buf2 = makeNoise(ctx, 'pink', 28);
            const s1 = mkSrc(buf1, 1.00); const s2 = mkSrc(buf2, 0.93);
            const bp = ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=380; bp.Q.value=1.3;
            const lpf = lp(900); const g2 = gain(0.42);
            const [swLfo] = lfo(0.011, 300, bp.frequency);
            const [ampLfo] = lfo(0.13, 0.27, layerGain.gain);
            s1.connect(bp); bp.connect(lpf); lpf.connect(layerGain);
            s2.connect(g2); g2.connect(layerGain);
            s1.start(); s2.start(ctx.currentTime+5);
            nodes.push(s1,s2,bp,lpf,g2,swLfo,ampLfo);

        // ── fire ──
        } else if (id === 'fire') {
            const buf = makeNoise(ctx, 'brown', 30);
            const s = mkSrc(buf); const lpf = lp(480); const [ampLfo] = lfo(0.07, 0.22, layerGain.gain);
            s.connect(lpf); lpf.connect(layerGain); s.start();
            nodes.push(s, lpf, ampLfo);
            // Crackles — true random, never repetitive
            const crackle = () => {
                const delay = 150 + Math.random() * 1150;
                const t = setTimeout(() => {
                    if (!layersRef.current[id] || !ctxRef.current) return;
                    const c = ctxRef.current;
                    const dur = 0.018 + Math.random() * 0.065;
                    const len = Math.floor(c.sampleRate * dur);
                    const cb = c.createBuffer(1, len, c.sampleRate);
                    const cd = cb.getChannelData(0);
                    for (let i = 0; i < len; i++) cd[i] = (Math.random()*2-1) * Math.pow(1-i/len, 3);
                    const cs = c.createBufferSource(); cs.buffer = cb;
                    const cf = hp(900 + Math.random()*2500);
                    const cg = gain(0.2 + Math.random() * 0.8);
                    cs.connect(cf); cf.connect(cg); cg.connect(masterRef.current!);
                    cs.start(); cs.stop(c.currentTime + dur + 0.01); crackle();
                }, delay);
                timers.push(t);
            };
            crackle();

        // ── café (synth fallback) — voice murmur + transients ──
        } else if (id === 'cafe') {
            // Multi-formant murmur: pink noise through 4 bandpass filters
            // centred on vowel formant frequencies
            const pBuf = makeNoise(ctx, 'pink', 30);
            const formants = [380, 780, 1200, 2400];
            formants.forEach((freq, i) => {
                const s = mkSrc(pBuf, 1.0 - i * 0.02);
                const bp = ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq; bp.Q.value=4;
                const g = gain(0.22 - i * 0.03);
                const [aLfo] = lfo(0.3 + i * 0.2 + Math.random()*0.3, g.gain.value*0.4, g.gain);
                s.connect(bp); bp.connect(g); g.connect(layerGain);
                s.start(ctx.currentTime + i * 0.3);
                nodes.push(s, bp, g, aLfo);
            });
            // Occasional cup/glass clink
            const clink = () => {
                const delay = 6000 + Math.random() * 18000;
                const t = setTimeout(() => {
                    if (!layersRef.current[id] || !ctxRef.current) return;
                    const c = ctxRef.current;
                    const osc = c.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.value = 2200 + Math.random() * 1800;
                    const eg = c.createGain();
                    eg.gain.setValueAtTime(0.06 + Math.random()*0.06, c.currentTime);
                    eg.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
                    osc.connect(eg); eg.connect(masterRef.current!);
                    osc.start(); osc.stop(c.currentTime + 0.45); clink();
                }, delay);
                timers.push(t);
            };
            clink();
        }

        timersRef.current[id] = timers;
        if (!existingGain || !layersRef.current[id]) {
            layersRef.current[id] = {
                gainNode: layerGain,
                stop: () => nodes.forEach(n => { try { (n as any).stop?.(); n.disconnect?.(); } catch {} }),
            };
        }
    }

    // ── Start a sound layer ────────────────────────────────────────────────
    function startLayer(sound: SoundDef, vol: number) {
        if (sound.type === 'file' && sound.src) {
            startFileSrc(sound.id, sound.src, vol);
        } else if (sound.type === 'playlist' && sound.srcs) {
            startPlaylist(sound.id, sound.srcs, vol);
        } else {
            startSynth(sound.id, vol);
        }
    }

    // ── Toggle ────────────────────────────────────────────────────────────
    const toggleSound = useCallback((sound: SoundDef) => {
        const isActive = (id: string) => !!layersRef.current[id];
        if (isActive(sound.id)) {
            stopLayer(sound.id);
            setActiveVols(prev => { const n = { ...prev }; delete n[sound.id]; return n; });
        } else {
            const vol = 0.5;
            startLayer(sound, vol);
            // if currently paused, immediately re-suspend ctx and pause new audio
            setPaused(prev => {
                if (prev) {
                    setTimeout(() => {
                        ctxRef.current?.suspend();
                        Object.values(audiosRef.current).forEach(a => a.pause());
                    }, 0);
                }
                return prev;
            });
            setActiveVols(prev => ({ ...prev, [sound.id]: vol }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Per-layer volume ──────────────────────────────────────────────────
    const setLayerVol = useCallback((id: string, vol: number) => {
        const layer = layersRef.current[id];
        if (layer && ctxRef.current) {
            layer.gainNode.gain.setTargetAtTime(vol, ctxRef.current.currentTime, 0.04);
        }
        setActiveVols(prev => ({ ...prev, [id]: vol }));
    }, []);

    // ── Pause / Resume ────────────────────────────────────────────────────
    const togglePause = useCallback(() => {
        setPaused(prev => {
            const next = !prev;
            // Suspend/resume Web Audio (synth sounds)
            if (ctxRef.current) {
                if (next) ctxRef.current.suspend();
                else ctxRef.current.resume();
            }
            // Pause/resume all HTMLAudioElements (file + playlist sounds)
            Object.values(audiosRef.current).forEach(a => {
                if (next) a.pause();
                else a.play().catch(() => {});
            });
            // Notify navbar after render (defer to avoid setState-during-render)
            const count = next ? 0 : Object.values(activeVols).filter(v => v > 0).length;
            setTimeout(() => window.dispatchEvent(new CustomEvent('brilliplan-ambient-change', { detail: { count } })), 0);
            return next;
        });
    }, [activeVols]);

    // ── Derived ───────────────────────────────────────────────────────────
    const activeSounds = SOUNDS.filter(s => activeVols[s.id] !== undefined);
    const catSounds    = SOUNDS.filter(s => s.category === activeCategory);
    const isAnyActive  = activeSounds.length > 0;

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div style={{
            borderRadius: 16,
            background: 'rgba(11,11,13,0.97)',
            border: `1px solid ${isAnyActive ? 'rgba(200,169,96,0.18)' : 'rgba(255,255,255,0.06)'}`,
            overflow: 'hidden',
            transition: 'border-color 0.3s',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        }}>
            {/* Header */}
            <div style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px',
                color: isAnyActive ? '#c8a960' : 'rgba(255,255,255,0.28)',
            }}>
                <Layers size={12} />
                <span style={{ flex: 1, textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    {isAnyActive
                        ? `${activeSounds.length} couche${activeSounds.length > 1 ? 's' : ''}`
                        : 'Ambiance'}
                </span>
                {isAnyActive && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Equalizer bars — hidden when paused */}
                        {!paused && (
                            <span style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                                {[1,2,3].map(i => (
                                    <span key={i} style={{ width: 2, borderRadius: 1, background: '#c8a960', animation: `amb-bar ${0.55+i*0.15}s ease-in-out infinite alternate` }}/>
                                ))}
                            </span>
                        )}
                        {/* Pause / Play button */}
                        <button
                            onClick={togglePause}
                            title={paused ? 'Reprendre' : 'Pause'}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 22, height: 22, borderRadius: 6,
                                border: `1px solid ${paused ? 'rgba(200,169,96,0.4)' : 'rgba(200,169,96,0.2)'}`,
                                background: paused ? 'rgba(200,169,96,0.15)' : 'rgba(200,169,96,0.06)',
                                color: '#c8a960', cursor: 'pointer',
                                transition: 'background 0.15s, border-color 0.15s',
                                flexShrink: 0,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,169,96,0.22)')}
                            onMouseLeave={e => (e.currentTarget.style.background = paused ? 'rgba(200,169,96,0.15)' : 'rgba(200,169,96,0.06)')}
                        >
                            {paused ? <Play size={10} /> : <Pause size={10} />}
                        </button>
                    </span>
                )}
            </div>

            <div style={{ padding: '0 10px 12px' }}>

                    {/* Category tabs */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                        {CATEGORIES.map(cat => {
                            const on = activeCategory === cat.id;
                            return (
                                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
                                    flex: 1, padding: '5px 2px', borderRadius: 8, cursor: 'pointer',
                                    border: `1px solid ${on ? 'rgba(200,169,96,0.28)' : 'rgba(255,255,255,0.05)'}`,
                                    background: on ? 'rgba(200,169,96,0.09)' : 'rgba(255,255,255,0.02)',
                                    color: on ? '#c8a960' : 'rgba(255,255,255,0.28)',
                                    fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: 'all 0.15s',
                                }}>
                                    <span style={{ fontSize: '0.9rem' }}>{cat.emoji}</span>
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Sound grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: 10 }}>
                        {catSounds.map(s => {
                            const isOn = activeVols[s.id] !== undefined;
                            return (
                                <button key={s.id} onClick={() => toggleSound(s)} style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer', minHeight: 58,
                                    border: `1.5px solid ${isOn ? s.color+'55' : 'rgba(255,255,255,0.06)'}`,
                                    background: isOn ? s.color+'14' : 'rgba(255,255,255,0.02)',
                                    color: isOn ? s.color : 'rgba(255,255,255,0.32)',
                                    transition: 'all 0.18s',
                                }}>
                                    <span style={{ fontSize: '1.1rem' }}>{s.emoji}</span>
                                    <span style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.3 }}>
                                        {s.label}
                                    </span>
                                    {isOn && (
                                        <span style={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', height: 8, marginTop: 1 }}>
                                            {[1,2,3].map(i => (
                                                <span key={i} style={{ width: 2, borderRadius: 1, background: s.color, animation: `amb-bar ${0.45+i*0.18}s ease-in-out infinite alternate` }}/>
                                            ))}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Per-layer volume sliders */}
                    {activeSounds.length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                                Mix
                            </div>
                            {activeSounds.map(s => (
                                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: '0.85rem', width: 18, textAlign: 'center', flexShrink: 0 }}>{s.emoji}</span>
                                    <input type="range" min="0" max="1" step="0.01"
                                        value={activeVols[s.id] ?? 0.5}
                                        onChange={e => setLayerVol(s.id, parseFloat(e.target.value))}
                                        style={{ flex: 1, height: 3, accentColor: s.color, cursor: 'pointer' }}
                                    />
                                    <button onClick={() => toggleSound(s)} style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'rgba(255,255,255,0.18)', padding: '0 2px', fontSize: '0.65rem', lineHeight: 1, flexShrink: 0,
                                    }}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Master volume */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => setMasterVol(v => v > 0 ? 0 : 0.7)} style={{
                            width: 24, height: 24, borderRadius: 6, border: 'none', flexShrink: 0,
                            background: 'rgba(255,255,255,0.04)',
                            color: masterVol > 0 ? (isAnyActive ? '#c8a960' : 'rgba(255,255,255,0.35)') : '#52525b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}>
                            {masterVol > 0 ? <Volume2 size={11} /> : <VolumeX size={11} />}
                        </button>
                        <input type="range" min="0" max="1" step="0.01" value={masterVol}
                            onChange={e => setMasterVol(parseFloat(e.target.value))}
                            style={{ flex: 1, height: 3, accentColor: '#c8a960', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.18)', width: 24, textAlign: 'right', flexShrink: 0 }}>
                            {Math.round(masterVol * 100)}
                        </span>
                    </div>
            </div>

            <style>{`
                @keyframes amb-bar { from { height: 3px; } to { height: 10px; } }
            `}</style>
        </div>
    );
}
