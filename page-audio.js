/** Recorded bend, friction and release; never a fixed noise loop. */
export class RecordedPage {
    constructor(context, output) {
        this.context = context;
        this.output = output;
        this.active = false;
        this.generation = 0;
        this.previous = -1;
        this.voices = new Map();
    }
    prepare() {
        return this.buffers ?? (this.buffers = Promise.all([1, 2, 3].map(async (n) => {
            const response = await fetch(`audio/page-${n}.wav`);
            if (!response.ok)
                throw new Error('종이 녹음을 읽지 못했어.');
            return this.context.decodeAudioData(await response.arrayBuffer());
        })).catch(error => { this.buffers = undefined; throw error; }));
    }
    async begin() {
        this.active = true;
        const ticket = ++this.generation;
        try {
            const buffers = await this.prepare();
            if (!this.active || ticket !== this.generation)
                return;
            let index = Math.floor(Math.random() * buffers.length);
            if (index === this.previous)
                index = (index + 1) % buffers.length;
            this.previous = index;
            this.selected = buffers[index];
            this.play(false);
        }
        catch {
            if (ticket === this.generation)
                this.active = false;
        }
    }
    play(landing) {
        const buffer = this.selected;
        if (!buffer)
            return;
        const context = this.context, source = context.createBufferSource(), gain = context.createGain(), at = context.currentTime;
        source.buffer = buffer;
        source.playbackRate.value = .94 + Math.random() * .12;
        const voice = { source, gain };
        if (!landing)
            this.voice = voice;
        source.connect(gain);
        gain.connect(this.output);
        this.voices.set(source, gain);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(landing ? .36 : .65, at + .012);
        if (landing) {
            gain.gain.linearRampToValueAtTime(0, at + .14);
            source.start(at, Math.max(0, buffer.duration - .19), .18);
        }
        else
            source.start(at, Math.random() * .025);
        source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(source); if (this.voice === voice)
            this.voice = undefined; };
    }
    motion(speed) {
        if (!this.active || !this.selected)
            return;
        const strength = Math.min(1, Math.abs(speed) / 1.5);
        if (!this.voice && strength > .04)
            this.play(false);
        if (!this.voice)
            return;
        const now = this.context.currentTime;
        this.voice.gain.gain.setTargetAtTime(.015 + strength * .75, now, .025);
        this.voice.source.playbackRate.setTargetAtTime(.82 + strength * .35, now, .04);
    }
    end(land = false) {
        this.active = false;
        this.generation++;
        this.voice = undefined;
        const now = this.context.currentTime;
        for (const [source, gain] of this.voices) {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setTargetAtTime(0, now, .018);
            try {
                source.stop(now + .08);
            }
            catch { /* The recording may have just finished. */ }
        }
        if (land && this.selected)
            this.play(true);
    }
}
