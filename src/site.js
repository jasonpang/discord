import './site.scss';
import './events-polyfill.js';
import Discord from './discord.js';
import log from 'loglevel';
import Song from './Song.js';
import Midi from './midi.js';
import Note from './Note.js';

log.setDefaultLevel('trace');

$(function() {
    $('.ui.dropdown').dropdown();

    $('#song-dropdown').dropdown('setting', 'onChange', function(fileName) {
        var fetchOpts = {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache' };
        fetch(`/assets/${fileName}`, fetchOpts).then((response) => {
            return response.blob();
        })
        .then((buffer) => Song.fromMidiFile(buffer, {
            trackZeroIsNoteData: $('#use-track-zero-checkbox').is(':checked'),
            perfectMidi: $('#perfect-midi-checkbox').is(':checked')
        }))
        .then(song => {
            window.song = song;
            console.info('Song Loaded:', song);
        }).catch((e) => log.error(e));
    });

    $('#mode-dropdown').dropdown('setting', 'onChange', function(mode) {
        if (window.discord) {
            window.discord.destroy();
        }
        let song = window.song;
        let options = {
            useChords: true
        };
        if (song) {
            options.split = song.tracks.length
        }
        window.discord = new Discord(mode, song, options);
    });

    $('#reverse-track-checkbox').change(function() {
        window.reverseTrack = true;
        let firstTrack = window.song.tracks[0];
        window.song.tracks[0] = window.song.tracks[1];
        window.song.tracks[1] = firstTrack;
    });

    $('#restart-song').click(function(e) {
        e.preventDefault();
        if (window.discord) {
            window.discord.restart();
        }
    });

    $('#send-midi').click(function(e) {
        e.preventDefault();
        if (window.discord) {
             
        } else {
            log.info('Discord not initialized yet.');
        }
    });
});