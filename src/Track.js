export default class Track {
    constructor() {
        this.name = '';
        this.objects = [];
        this.controllers = {
            // Which controller (e.g. 64 for sustain pedal)
            // 64: [{ at: value }]
        };
    }
}