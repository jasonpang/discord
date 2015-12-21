export default class Note {
    constructor(name, number, octave, time, duration, velocity) {
        this.name = name;
        this.number = number;
        this.octave = octave;
        this.time = time;
        this.duration = duration;
        this.velocity = velocity;
    }

    static fromRawNote(note) {
        return new Note(note.note.name, note.note.number, note.note.octave, note.receivedTime, 0, note.velocity);
    }

    static fromRawNotes(a, b) {
        return new Note(a.note.name, a.note.number, a.note.octave, a.receivedTime, b.receivedTime - a.receivedTime, a.velocity);
    }

    static get MIN_NUMBER() {
        return 21;
    }

    static get MAX_NUMBER() {
        return 108;
    }
}