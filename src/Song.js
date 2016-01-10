import MIDIFile from 'midifile';
import Track from './Track.js';
import Note from './Note.js';
import log from 'loglevel';
import Chord from './Chord.js';

export default class Song {

    constructor() {
        this.tracks = [];
    }

    static get CHORD_DELAY_INTERVAL() {
        // 35 milliseconds between two notes being played is the max time to be considered part of the same chord
        return 35;
    }

    static fromMidiFile(file, options) {
        return new Promise((resolve) => {
            let song = new Song();
            let reader = new FileReader();
            reader.readAsArrayBuffer(file);
            reader.onloadend = (e) => {
                let buffer = e.target.result;
                let midiFile = new MIDIFile(buffer);

                // Format 0, 1, or 2 MIDI file?
                song.midiFormat = midiFile.header.getFormat();
                if (song.midiFormat !== 1) {
                    throw new Error('Only format 1 MIDI files are supported. Please input a MIDI file with format 1.');
                }
                // Metrical or timecode time division?
                if (midiFile.header.getTimeDivision() === 2) {
                    song.ticksPerBeat = midiFile.header.getTicksPerBeat();
                } else {
                    throw new Error('This MIDI file uses timecode time division. Parsing this file is not supported yet. Please input a MIDI file using metrical time division.');
                }
                if (midiFile.header.getTracksCount() === 1) {
                    throw new Error("This format 1 MIDI file has only one track (the special first track used for global info). It doesn't have any note data.")
                }

                // Define a helpful map of MIDI event subtypes to event names
                let eventMap = {
                    0x00: 'Sequence Number',
                    0x01: 'Text',
                    0x02: 'Copyright Notice',
                    0x03: 'Track Name',
                    0x04: 'Instrument Name',
                    0x05: 'Lyrics',
                    0x06: 'Marker',
                    0x07: 'Cue Point',
                    0x20: 'Midi Channel Prefix',
                    0x2F: 'End of Track',
                    0x51: 'Set Tempo',
                    0x54: 'SMTPE Offset',
                    0x58: 'Time Signature',
                    0x59: 'Key Signature',
                    0x7F: 'Sequencer Specific',
                    0x8: 'Note Off',
                    0x9: 'Note On',
                    0xA: 'Aftertouch',
                    0xB: 'Controller',
                    0xC: 'Program Change',
                    0xD: 'Channel Aftertouch',
                    0xE: 'Pitch Bend'
                };

                // Create a helper function that takes in a raw event and turns it into a friendly readable object
                // Common events are processed to only include useful information, everything else is removed
                let getProcessedEvent = function getProcessedEvent(event) {
                    let pEvent = {
                        type: eventMap[event.subtype]
                    };
                    if (event.hasOwnProperty('delta')) {
                        pEvent.delta = event.delta;
                    }
                    // Track Name
                    if (pEvent.type === 'Track Name' ||
                        pEvent.type === 'Text' ||
                        pEvent.type === 'Copyright Notice') {
                        // Convert hexadecimal-encoded text into plain ASCII text
                        if (event.data) {
                            pEvent.data = '';
                            for (let d of event.data) {
                                pEvent.data += String.fromCharCode(d, 16);
                            }
                        }
                    }
                    // Set Tempo
                    else if (pEvent.type === 'Set Tempo') {
                        pEvent.tempo = event.tempo;
                        pEvent.tempoBPM = event.tempoBPM;
                    }
                    else if (pEvent.type === 'Time Signature') {
                        pEvent.timeSignatureNumerator = event.param1;
                        // Time signature denominators are stored as powers of two
                        pEvent.timeSignatureDenominator = Math.pow(2, event.param2);
                        pEvent.clocksBetweenMetroClick = event.param3;
                        pEvent.num32NotesInQuarterNote = event.param4;
                    }
                    else if (pEvent.type === 'Program Change') {
                        pEvent.channel = event.channel;
                        pEvent.program = event.param1;
                    }
                    else if (pEvent.type === 'Controller') {
                        pEvent.controller = event.param1;
                        pEvent.value = event.param2;
                    }
                    else if (pEvent.type === 'Note On' || pEvent.type === 'Note Off') {
                        pEvent.note = event.param1;
                        pEvent.velocity = event.param2;
                    }
                    else if (pEvent.type === 'End of Track') {
                    }
                    else {
                        // Unrecognized event, so copy all the original params in case we need to see it
                        pEvent = Object.assign({}, pEvent, event);
                    }
                    return pEvent;
                };

                // Read the first track, which is a special track containing global info, to get important stuff
                let trackEvents = midiFile.getTrackEvents(0);
                let trackTime = 0;
                for (let i = 0; i < trackEvents.length; i++) {
                    let rawEvent = trackEvents[i];
                    let event = getProcessedEvent(rawEvent);
                    if (event.delta)
                        trackTime += event.delta;
                    if (event.type === "Track Name")
                        song.name = event.data;
                    else if (event.type === "Text") {
                        if (!song.text)
                            song.text = [];
                        song.text.push(event.data);
                    }
                    else if (event.type === "Copyright Notice") {
                        if (!song.copyrightNotices)
                            song.copyrightNotices = [];
                        song.copyrightNotices.push(event.data);
                    }
                    else if (event.type === 'Set Tempo') {
                        if (!song.tempoChanges)
                            song.tempoChanges = [];
                        song.tempoChanges.push({at: trackTime, tempo: event.tempo, tempoBpm: event.tempoBPM});
                    }
                    else if (event.type === 'Time Signature') {
                        song.timeSignatureNumerator = event.timeSignatureNumerator;
                        song.timeSignatureDenominator = event.timeSignatureDenominator;
                        song.clocksBetweenMetronomeClick = event.clocksBetweenMetroClick;
                        song.num32NotesInQuarterNote = event.num32NotesInQuarterNote;
                    }
                }

                // Read the rest of the tracks

                // Import the notes for each track
                song.tracks = [];

                let _notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
                let allChannels = [];

                if (options.trackZeroIsNoteData) {
                    var trackIndex = 0;
                } else {
                    var trackIndex = 1;
                }

                // Import the notes for each track
                let trackCount = midiFile.header.getTracksCount();
                for (trackIndex; trackIndex < trackCount; trackIndex++) {
                    let track = new Track();
                    let trackEvents = midiFile.getTrackEvents(trackIndex);
                    trackTime = 0;
                    let tempHeldNotes = {/* noteNumber : track.objects index */};
                    let onOffStack = 0;
                    for (let i = 0; i < trackEvents.length; i++) {
                        let rawEvent = trackEvents[i];
                        let event = getProcessedEvent(rawEvent);
                        if (event.delta)
                            trackTime += event.delta;
                        if (rawEvent.hasOwnProperty('channel')) {
                            event.channel = rawEvent.channel;
                            if (!allChannels.includes(event.channel)) {
                                allChannels.push(event.channel);
                            }
                        }
                        if (event.type === 'Track Name') {
                            track.name = event.data;
                        }
                        else if (event.type === 'Controller') {
                            if (!track.controllers[event.controller])
                                track.controllers[event.controller] = [];
                            track.controllers[event.controller].push({at: trackTime, value: event.value});
                        }
                        else if (event.type === 'Note On') {
                            // Finale SmartMusic SoftSynth incorrectly puts a weird trademark on the first Note On event
                            if (rawEvent.data) {
                                rawEvent.readableData = '';
                                for (let d of rawEvent.data) {
                                    rawEvent.readableData += String.fromCharCode(d, 16);
                                }
                            }
                            if (!event.note)
                                continue;
                            let name = _notes[event.note % 12];
                            let octave = Math.floor(event.note / 12 - 1) - 3;
                            let note = new Note(name, event.note, octave, trackTime, null, event.velocity);
                            track.objects.push(note);
                            tempHeldNotes[event.note] = track.objects.length - 1;
                        }
                        else if (event.type === 'Note Off') {
                            if (!event.note)
                                continue;
                            let targetIndex = tempHeldNotes[event.note];
                            if (targetIndex === null) {
                                console.warn(`Ignoring a Note Off event that was fired for a note that was never played.`);
                                continue;
                            }
                            tempHeldNotes[event.note] = null;
                            let note = track.objects[targetIndex];
                            note.duration = trackTime - note.time;
                        }
                    }
                    song.tracks.push(track);
                }

                // Split song by channels if not by tracks
                log.info('All Channels:', allChannels);
                if (allChannels.length > 1) {
                    console.warn("It seems this track used multiple channels, so we're going to split the song by channel.");
                }

                for (let trackIndex = 0; trackIndex < song.tracks.length; trackIndex++) {
                    let track = song.tracks[trackIndex];
                    for (let objectIndex = 0; objectIndex < track.objects.length - 1; objectIndex++) {
                        let note = track.objects[objectIndex];
                        //note *= 250;
                    }
                }

                // We're done reading from the MIDI file, now let's convert notes occurring at the same time to chords
                for (let trackIndex = 0; trackIndex < song.tracks.length; trackIndex++) {
                    let finalObjects = [];
                    let numNotesConverted = 0;
                    let existingTotalNotes = song.tracks[trackIndex].objects.length;
                    for (let objectIndex = 0; objectIndex < song.tracks[trackIndex].objects.length - 1; objectIndex++) {
                        let note = song.tracks[trackIndex].objects[objectIndex];
                        let nextNote = song.tracks[trackIndex].objects[objectIndex + 1];

                        let chordLength = 1;
                        let indexCopy = objectIndex;
                        let noteCopy = note;
                        let nextNoteCopy = nextNote;
                        let chord = new Chord();
                        chord.add(noteCopy);
                        if (nextNoteCopy === undefined || noteCopy === undefined) {
                            debugger;
                        }
                        while (nextNoteCopy.time - noteCopy.time <= Song.CHORD_DELAY_INTERVAL) {
                            chord.add(nextNoteCopy);
                            chordLength++;
                            if (indexCopy + 1 >= song.tracks[trackIndex].objects.length - 1) // End of song
                                break;
                            indexCopy++;
                            noteCopy = nextNoteCopy;
                            nextNoteCopy = song.tracks[trackIndex].objects[indexCopy + 1];
                        }
                        if (chordLength === 1) {
                            finalObjects.push(note);
                        } else if (chordLength > 1) {
                            // Sort chords from lowest key to highest key
                            chord.notes = chord.notes.sort(function(a, b) {
                                return a.number - b.number;
                            });
                            finalObjects.push(chord);
                            numNotesConverted++;
                            objectIndex += chordLength - 1; // skip notes
                        }
                    }
                    log.debug(`Track ${trackIndex}: Converted ${numNotesConverted} / ${existingTotalNotes} notes to chords.`);
                    song.tracks[trackIndex].objects = finalObjects;
                }
                resolve(song);
            };
        });
    }
}