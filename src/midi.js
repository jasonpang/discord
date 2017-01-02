import log from 'loglevel';
import WebMidi from 'webmidi';
import Note from './Note.js';
import Event from './Event.js';


export default class Midi {

    static initialize() {
        if (!WebMidi.connected) {
            return new Promise((resolve, reject) => {
                    WebMidi.enable(() => {
                        log.debug('Web MIDI now initialized and usable!');
                        resolve();
                    }, (reason) => {
                        log.error('Could not initialize Web MIDI interface:', reason);
                        reject(reason);
                    })
                }
            );
        }
        else return Promise.resolve();
    }

    static get inputs() {
        return WebMidi.inputs;
    }

    static get outputs() {
        return WebMidi.outputs;
    }

    /**
     * Returns the matching MIDI input or output;
     * @param nameOrOptions Either an exact string match of the input/output name, or an object specifying search parameters.
     *     {
     *         name: 'loopbe',
     *         caseSensitiveSearch: false,
     *         usePartialMatch: true
     *     }
     * @returns {*}
     */
    static findInputOutput(nameOrOptions, inputOrOutput = 'input') {
        let target = inputOrOutput === 'input' ? WebMidi.inputs : WebMidi.outputs;
        if (typeof nameOrOptions === 'string') {
            for (let input in target) {
                if (input.name === nameOrOptions)
                    return input;
            }
        }
        else {
            for (let input of target) {
                if (!nameOrOptions.caseSensitiveSearch && !nameOrOptions.usePartialMatch) {
                    if (input.name.toLowerCase() === nameOrOptions.name.toLowerCase()) {
                        return input;
                    }
                } else if (!nameOrOptions.caseSensitiveSearch && nameOrOptions.usePartialMatch) {
                    if (input.name.toLowerCase().includes(nameOrOptions.name.toLowerCase())) {
                        return input;
                    }
                } else if (nameOrOptions.caseSensitiveSearch() && !nameOrOptions.usePartialMatch) {
                    if (input.name === nameOrOptions) {
                        return input;
                    }
                } else if (nameOrOptions.caseSensitiveSearch() && nameOrOptions.usePartialMatch) {
                    if (input.name.includes(nameOrOptions)) {
                        return input;
                    }
                }
            }
        }
    }

    static activate(inputFilter, outputFilter) {
        Midi.inputFilter = inputFilter;
        Midi.outputFilter = outputFilter;
        log.info(`MIDI Input: ${inputFilter.input ? inputFilter.input.name : WebMidi.inputs.map((o) => o.name)} (channel ${inputFilter.channel ? inputFilter.channel : 'all'})`);
        log.info(`MIDI Output: ${outputFilter.output ? outputFilter.output.name : WebMidi.outputs.map((o) => o.name)} (channel ${outputFilter.channel ? outputFilter.channel : 'all'})`);
        WebMidi.addListener('noteon', Midi.onNoteOn, inputFilter);
        WebMidi.addListener('noteoff', Midi.onNoteOff, inputFilter);
        WebMidi.addListener('controlchange', Midi.onControlChange, inputFilter);
        log.debug('Installed listeners for note on, note off, and CC events.');
    }

    static deactivate() {
        WebMidi.removeListener('noteon', Midi.onNoteOn);
        WebMidi.removeListener('noteoff', Midi.onNoteOff);
        WebMidi.removeListener('controlchange', Midi.onControlChange);
        log.debug('Removed listeners for note on, note off, and CC events.');
    }

    static onNoteOn(rawNote) {
        if (!Midi.noteStore) {
            Midi.noteStore = [];
        }
        let note = Note.fromRawNote(rawNote);
        Midi.noteStore[note.number] = rawNote;
        Event.trigger('note.on', note);
    }

    static onNoteOff(rawNote) {
        let note = Note.fromRawNote(rawNote);
        Event.trigger('note.off', note);

        let noteIndex = note.number;
        let savedNote = Midi.noteStore[noteIndex];
        Midi.noteStore[noteIndex] = null;
        let noteA = savedNote;
        let noteB = rawNote;
        Event.trigger('note', Note.fromRawNotes(noteA, noteB));
    }

    static onControlChange(rawCc) {
        Event.trigger('controller.change', {at: WebMidi.time, controller: rawCc.controller.number, value: rawCc.value});
    }

    static play({note, number = note.number, velocity = note.velocity, duration = note.duration, channels = Midi.outputFilter.channel || "all", outputs = Midi.outputFilter.output, when = 0} = {}) {
        WebMidi.playNote(number, velocity, duration === 'hold' ? undefined : duration, outputs, channels, '+' + when);
    }

    static endPlay({note, velocity = 0, channels = Midi.outputFilter.channel || "all", outputs = Midi.outputFilter.output, when = 0} = {}) {
        WebMidi.stopNote(note, velocity, outputs, channels, when);
    }

    static controller({controller, value = 0, channels = Midi.outputFilter.channel || "all", outputs = Midi.outputFilter.output, when = 0} = {}) {
        WebMidi.sendControlChange(controller, value, outputs, channels, when);
    }
}