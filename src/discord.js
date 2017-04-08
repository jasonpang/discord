import Midi from './midi.js';
import Note from './Note.js';
import Song from './Song.js';
import Track from './Track.js';
import log from 'loglevel';
import Chord from './Chord.js';
import 'setimmediate';

export default class Discord {
    constructor(mode, song, options = {}) {

        window.Midi = Midi;
        console.log("Initializing Discord()..");
        this.song = song;
        this.options = options;
        if (mode === 'play' || mode === 'passthru') {
            Midi.initialize()
                .then(() => {
                    let inputFilter = {
                        channel: 1,
                        input: Midi.findInputOutput({
                            name: 'xmidi',
                            caseSensitiveSearch: false,
                            usePartialMatch: true
                        }, 'input')
                    };
                    let outputFilter = {
                        channel: 1,
                        output: Midi.findInputOutput({
                            name: 'loopbe',
                            caseSensitiveSearch: false,
                            usePartialMatch: true
                        }, 'output')
                    };
                    Midi.activate(inputFilter, outputFilter);
                    if (mode === 'play')
                        this.playMode();
                    else
                        this.passThruMode();
                });
        }
    }

    destroy() {
        Midi.deactivate();
    }

    getVoiceNumber(noteNumber) {
        let noteRange = Note.MAX_NUMBER - Note.MIN_NUMBER;
        let voiceCount = 2;
        if (this.song && this.song.tracks)
            voiceCount = this.song.tracks.length;
        for (let i = 0; i < voiceCount; i++) {
            let rangeOffset = noteRange / voiceCount;
            let voiceMin = Math.ceil(Note.MIN_NUMBER + (rangeOffset * i));
            let voiceMax = Math.floor(voiceMin + rangeOffset);
            if (noteNumber >= voiceMin && noteNumber <= voiceMax) {
                return i;
            }
        }
    }

    playMode() {
        this.record = new Song();
        for (let i of this.song.tracks)
            this.record.tracks.push(new Track());
        for (let i = 0; i < this.record.tracks.length; i++) {
            this.record.tracks[i].lastPlayTime = 0;
            this.record.tracks[i].noteIndex = 0;
            this.record.tracks[i].heldNotes = [];
        }
        window.record = this.record;
        window.addEventListener('note.on', (note) => {
            note = note.detail;
            let voice = this.getVoiceNumber(note.number);
            let track = this.record.tracks[voice];
            if (!track.ons)
                track.ons = [];
            track.ons.push(note);
        });
        window.addEventListener('note.off', (note) => {
            note = note.detail;
            let voice = this.getVoiceNumber(note.number);
            let track = this.record.tracks[voice];
            if (!track.offs)
                track.offs = [];
            track.offs.push(note);
        });
        window.addEventListener('controller.change', (cc) => {
            cc = cc.detail;
            Midi.controller({controller: cc.controller, value: cc.value});
        });

        for (var i = 0; i < this.song.tracks.length; i++) {
            setTimeout(this.playMode_process.bind(this, i), 0);
        }
    }

    restart() {
        for (let record of this.record.tracks) {
            record.ons = [];
            record.offs = [];
            record.lastPlayTime = 0;
            record.noteIndex = 0;
            record.heldNotes = [];
        }
    }

    play({note, number, velocity, duration, channels = Midi.outputFilter.channel || "all", outputs = Midi.outputFilter.output, when = 0} = {}) {
        Midi.play({
            note: firstPlayedKey,
            number: recordedChord[b].number,
            duration: 'hold',
            channels: voice + 1
        });
    }

    playMode_process(voice) {
        if (window.reverseTrack) {
            var trueVoice = voice;
        } else {
            var trueVoice = voice;
        }
        let track = this.song.tracks[voice].objects;
        let record = this.record.tracks[voice];
        if (!record.ons) {
            setImmediate(this.playMode_process.bind(this, voice), 0);
            return;
        }
        while (record.ons.length > 0) {
            let playedNote = record.ons[0];
            if (this.options.useChords && performance.now() - record.lastPlayTime <= Song.CHORD_DELAY_INTERVAL) {
                record.ons.shift();
                continue;
            }

            let recordedNoteOrChord = track[record.noteIndex];
            if (recordedNoteOrChord === undefined) {
                record.ons = [];
                record.offs = [];
                console.warn("Congratulations! You've reached the end of the track! ^_^");
                return;
            }
            if (recordedNoteOrChord instanceof Chord) {
                let recordedChord = recordedNoteOrChord.notes;
                // Sort played keys from lowest key to highest key, in case we play 3 notes out of order (middle finger lands first)
                recordedChord = recordedChord.sort(function(a, b) {
                    return a.number - b.number;
                });
                record.noteIndex++;
                // If a 5-triad chord is played with 3 fingers, 2 fingers are "missing"
                let fingersMissingCount = recordedChord.length - record.ons.length;
                if (fingersMissingCount > 0) {
                    let firstPlayedKey;
                    if (trueVoice === 1) {
                        for (let a = 0; a < record.ons.length; a++) {
                            if (a === 0) {
                                firstPlayedKey = record.ons[a];
                            }
                            let playedKey = record.ons.shift();
                            record.heldNotes[playedKey.number] = recordedChord[a + fingersMissingCount].number;
                            Midi.play({
                                note: playedKey,
                                number: recordedChord[a + fingersMissingCount].number,
                                velocity: playedKey.velocity,
                                duration: 'hold',
                                channels: voice + 1
                            });
                            log.debug(`${playedKey.name}: ${playedKey.velocity * 1.05} (Treble)*`);
                        }
                        record.heldNotes[firstPlayedKey.number] = [record.heldNotes[firstPlayedKey.number]];
                        for (let b = 0; b < fingersMissingCount; b++) {
                            record.heldNotes[firstPlayedKey.number].push(recordedChord[b].number);
                            Midi.play({
                                note: firstPlayedKey,
                                number: recordedChord[b].number,
                                velocity: firstPlayedKey.velocity,
                                duration: 'hold',
                                channels: voice + 1
                            });
                            log.debug(`${recordedChord[b].name}: ${firstPlayedKey.velocity} (Treble)`);
                        }
                    } else if (trueVoice === 0) {
                        for (let a = 0; a < record.ons.length; a++) {
                            if (a === 0) {
                                firstPlayedKey = record.ons[a];
                            }
                            let playedKey = record.ons.shift();
                            record.heldNotes[playedKey.number] = recordedChord[a].number;
                            Midi.play({
                                note: playedKey,
                                number: recordedChord[a].number,
                                velocity: firstPlayedKey.velocity,
                                duration: 'hold',
                                channels: voice + 1
                            });
                            log.debug(`${playedKey.name}: ${playedKey.velocity} (Bass)*`);
                        }
                        record.heldNotes[firstPlayedKey.number] = [record.heldNotes[firstPlayedKey.number]];
                        for (let b = record.ons.length + 1; b < fingersMissingCount + 1; b++) {
                            record.heldNotes[firstPlayedKey.number].push(recordedChord[b].number);
                            Midi.play({
                                note: firstPlayedKey,
                                number: recordedChord[b].number,
                                velocity: firstPlayedKey.velocity,
                                duration: 'hold',
                                channels: voice + 1
                            });
                            log.debug(`${recordedChord[b].name}: ${firstPlayedKey.velocity} (Bass)`);
                        }
                    }

                } else {
                    // No fingers missing. For 3-triad chord, use the highest keypress to sound the highest note
                    for (let a = 0; a < recordedChord.length; a++) {
                        let playedKey = record.ons.shift();
                        record.heldNotes[playedKey.number] = recordedChord[a].number;
                        Midi.play({
                            note: playedKey,
                            number: recordedChord[a].number,
                            duration: 'hold',
                            channels: voice + 1
                        });
                    }
                }
            } else {
                let recordedNote = recordedNoteOrChord;
                record.noteIndex++;
                record.heldNotes[playedNote.number] = recordedNote.number;
                Midi.play({
                    note: playedNote,
                    number: recordedNote.number,
                    duration: 'hold',
                    channels: voice + 1
                });
                record.ons.shift();
            }
            if (this.options.useChords) {
                record.lastPlayTime = performance.now();
            }
        }
        while (record.offs && record.offs.length > 0) {

            let playedNote = record.offs[0];
            //let voice = self._rehearse_getVoiceForKey(playedNote.number);
            //if (self.allowNewFeatures && (performance.now() - self.lastPlayTime[voice] <= self.MAGIC_NUMBER)) {
            //    self.noteOffs.shift();
            //    continue;
            //}

            let recordedNote = record.heldNotes[playedNote.number];
            if (typeof recordedNote === 'number') {
                Midi.endPlay({
                    note: recordedNote,
                    channels: voice + 1
                });
            }
            else if (typeof recordedNote === 'object') {
                // Was holding down a chord with a note
                // e.g. I play number 42 on piano, and it holds down 36, 37, 38. Lifting off 42 lifts off 36, 37, 38.
                recordedNote.forEach((note) =>{
                    Midi.endPlay({
                        note: note,
                        channels: voice + 1
                    });
                });
            }
            record.offs.shift();
        }
      setImmediate(this.playMode_process.bind(this, voice), 0);
    }

    passThruMode() {
        window.addEventListener('note.on', (note) => {
            note = note.detail;
            //let voice = this.getVoiceNumber(note.number);
            Midi.play({note: note, duration: 'hold'});
        });
        window.addEventListener('note.off', (note) => {
            note = note.detail;
            //let voice = this.getVoiceNumber(note.number);
            Midi.endPlay({note: note.number});
        });
        window.addEventListener('controller.change', (cc) => {
            cc = cc.detail;
            Midi.controller({controller: cc.controller, value: cc.value});
        });
    }
}