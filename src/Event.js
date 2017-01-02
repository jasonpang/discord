import { getConsoleStyle } from './utils.js';
import log from 'loglevel';


const SILENT_EVENTS = [
    //'note.on',
    //'note.off',
    //'controller.change'
    'note'
];

export default class Event {
    static trigger(eventName, data) {
        if (SILENT_EVENTS.indexOf(eventName) == -1) {
            let displayData = data;
            if (displayData || displayData === false) {
                log.debug(`%c${eventName}:`, getConsoleStyle('event'), displayData);
            } else {
                log.debug(`%c${eventName}`, getConsoleStyle('event'));
            }
        }
        var event = new CustomEvent(eventName, {
            bubbles: true, cancelable: true, details: data
        });
        window.dispatchEvent(event);
    }
}