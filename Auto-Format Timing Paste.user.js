
// ==UserScript==
// @name         AuditBook Auto-Format Timing Paste updated aug-20
// @namespace    http://tampermonkey.net/
// @version      9.19
// @description  Format and paste timing data for AuditBook with concatenated time range support
// @author       mfaiyazj
// @match        https://auditbook-na.corp.amazon.com/audit
// @match        https://auditbook-eu.corp.amazon.com/audit
// @grant        none
// ==/UserScript==

/**
 * ════════════════════════════════════════════════════════
 *  SCRIPT OVERVIEW
 * ════════════════════════════════════════════════════════
 *  This Tampermonkey userscript runs on AuditBook pages.
 *  It injects a draggable floating "Paste" button on the page.
 *  When clicked, it:
 *    1. Reads text from the clipboard
 *    2. Cleans and normalizes the timing text
 *    3. Parses it into per-day timings (MON–SUN)
 *    4. Fills the corresponding OUTPUT_MON … OUTPUT_SUN input fields
 *
 *  Also injects a standalone "Outdoor" button that sets all days
 *  to 00:00-23:59 (24hrs) or Non-Actionable if already matching.
 *
 *  v9.19 FIXES:
 *    - Midnight boundary (12 AM end → 23:59)
 *    - AM/PM inheritance (hours-only comparison)
 *    - Hour > 12 with AM/PM (22 PM → 22:00, not 34:00)
 *    - 24:00 → 23:59
 *    - Multi-lang dot cleanup (Day. → Day)
 *    - Step 7 expanded for day RANGES on separate lines
 *    - Case 4 processes remaining lines after range match
 *    - OUTPUT_Comments1 field support
 * ════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    // ════════════════════════════════════════════════════════
    // SECTION 1 START: Script Settings
    // ════════════════════════════════════════════════════════
    const SETTINGS = {
        ENABLE_MULTILANG_DAYS: true
    };
    // SECTION 1 END: Script Settings
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // SECTION 2 START: Multi-Language Day Name Map
    // ════════════════════════════════════════════════════════
    const MULTILANG_DAY_MAP = {
        // ── Spanish ──────────────────────────────────────────
        'lunes':          'Monday',
        'lun':            'Monday',
        'lu':             'Monday',
        'martes':         'Tuesday',
        'mar':            'Tuesday',
        'ma':             'Tuesday',
        'miércoles':      'Wednesday',
        'miercoles':      'Wednesday',
        'mié':            'Wednesday',
        'mie':            'Wednesday',
        'mi':             'Wednesday',
        'jueves':         'Thursday',
        'jue':            'Thursday',
        'ju':             'Thursday',
        'viernes':        'Friday',
        'vie':            'Friday',
        'vi':             'Friday',
        'sábado':         'Saturday',
        'sabado':         'Saturday',
        'sáb':            'Saturday',
        'sab':            'Saturday',
        'sa':             'Saturday',
        'domingo':        'Sunday',
        'dom':            'Sunday',
        'do':             'Sunday',
        'sábados':        'Saturday',
        'sabados':        'Saturday',
        'domingos':       'Sunday',

        // ── Italian ──────────────────────────────────────────
        'lunedì':         'Monday',
        'lunedi':         'Monday',
        'martedì':        'Tuesday',
        'martedi':        'Tuesday',
        'mercoledì':      'Wednesday',
        'mercoledi':      'Wednesday',
        'mer':            'Wednesday',
        'me':             'Wednesday',
        'giovedì':        'Thursday',
        'giovedi':        'Thursday',
        'gio':            'Thursday',
        'gi':             'Thursday',
        'venerdì':        'Friday',
        'venerdi':        'Friday',
        'ven':            'Friday',
        've':             'Friday',
        'sabato':         'Saturday',
        'domenica':       'Sunday',

        // ── German ───────────────────────────────────────────
        'montag':         'Monday',
        'mo':             'Monday',
        'dienstag':       'Tuesday',
        'di':             'Tuesday',
        'mittwoch':       'Wednesday',
        'donnerstag':     'Thursday',
        'freitag':        'Friday',
        'fr':             'Friday',
        'samstag':        'Saturday',
        'sonntag':        'Sunday',
        'so':             'Sunday',

        // ── French ───────────────────────────────────────────
        'lundi':          'Monday',
        'mardi':          'Tuesday',
        'mercredi':       'Wednesday',
        'jeudi':          'Thursday',
        'jeu':            'Thursday',
        'je':             'Thursday',
        'vendredi':       'Friday',
        'samedi':         'Saturday',
        'sam':            'Saturday',
        'dimanche':       'Sunday',
        'dim':            'Sunday',

        // ── Portuguese ───────────────────────────────────────
        'segunda-feira':  'Monday',
        'segunda':        'Monday',
        'seg':            'Monday',
        'se':             'Monday',
        'terça-feira':    'Tuesday',
        'terca-feira':    'Tuesday',
        'terça':          'Tuesday',
        'terca':          'Tuesday',
        'ter':            'Tuesday',
        'te':             'Tuesday',
        'quarta-feira':   'Wednesday',
        'quarta':         'Wednesday',
        'qua':            'Wednesday',
        'qu':             'Wednesday',
        'quinta-feira':   'Thursday',
        'quinta':         'Thursday',
        'qui':            'Thursday',
        'qi':             'Thursday',
        'sexta-feira':    'Friday',
        'sexta':          'Friday',
        'sex':            'Friday',
        'sx':             'Friday',
        'sábado':         'Saturday',
        'sabado':         'Saturday',
        'sáb':            'Saturday',
        'sab':            'Saturday',
        'domingo':        'Sunday',
        'dom':            'Sunday',

        // ── Catalan ──────────────────────────────────────────
        'dilluns':        'Monday',
        'dl':             'Monday',
        'dimarts':        'Tuesday',
        'dt':             'Tuesday',
        'dimecres':       'Wednesday',
        'dc':             'Wednesday',
        'dijous':         'Thursday',
        'dj':             'Thursday',
        'divendres':      'Friday',
        'dv':             'Friday',
        'dissabte':       'Saturday',
        'ds':             'Saturday',
        'diumenge':       'Sunday',
        'dg':             'Sunday'
    };
    // SECTION 2 END: Multi-Language Day Name Map
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 3 START: translateMultiLangDays
    // ════════════════════════════════════════════════════════
    function translateMultiLangDays(text) {
        if (!SETTINGS.ENABLE_MULTILANG_DAYS) return text;

        const keys = Object.keys(MULTILANG_DAY_MAP).sort((a, b) => b.length - a.length);

        for (const key of keys) {
            const englishDay = MULTILANG_DAY_MAP[key];
            const escaped = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const pattern = new RegExp('(?<![\\w\\u00C0-\\u024F])' + escaped + '(?![\\w\\u00C0-\\u024F])', 'gi');
            text = text.replace(pattern, englishDay);
        }

        return text;
    }
    // FUNCTION 3 END: translateMultiLangDays
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // SECTION 4 START: Inject CSS Styles
    // ════════════════════════════════════════════════════════
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        #floatingPasteButton {
            position: fixed;
            bottom: 25%;
            right: 5%;
            background-color: #ffffff;
            color: #000000;
            border: 1px solid #232f3e;
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 11px;
            font-weight: 500;
            cursor: move;
            z-index: 10000;
            box-shadow: 0 1px 5px rgba(0,0,0,0.3);
            transition: box-shadow 0.2s;
            user-select: none;
        }
        #floatingPasteButton:hover {
            background-color: #f0f0f0;
            box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        }
        #floatingPasteButton:active {
            cursor: grabbing;
        }
        #floatingOutdoorButton {
            position: fixed;
            bottom: calc(25% - 30px);
            right: 5%;
            background-color: #ffffff;
            color: #000000;
            border: 1px solid #232f3e;
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 1px 5px rgba(0,0,0,0.3);
            transition: box-shadow 0.2s;
            user-select: none;
        }
        #floatingOutdoorButton:hover {
            background-color: #f0f0f0;
            box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        }
        #statusMessage {
            position: fixed;
            top: calc(25% + 50px);
            right: 12.5%;
            background-color: rgba(0,0,0,0.7);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            display: none;
            transition: opacity 0.3s;
            max-width: 300px;
        }
    `;
    document.head.appendChild(styleElement);
    // SECTION 4 END: Inject CSS Styles
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // SECTION 5 START: Create UI Elements
    // ════════════════════════════════════════════════════════
    const pasteButton = document.createElement('button');
    pasteButton.id = 'floatingPasteButton';
    pasteButton.textContent = 'Paste';
    document.body.appendChild(pasteButton);

    const outdoorButton = document.createElement('button');
    outdoorButton.id = 'floatingOutdoorButton';
    outdoorButton.textContent = 'Outdoor';
    document.body.appendChild(outdoorButton);

    const statusMessage = document.createElement('div');
    statusMessage.id = 'statusMessage';
    document.body.appendChild(statusMessage);
    // SECTION 5 END: Create UI Elements
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // SECTION 6 START: Drag State Variables
    // ════════════════════════════════════════════════════════
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    let wasDragged = false;
    // SECTION 6 END: Drag State Variables
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // SECTION 7 START: Attach Drag Event Listeners
    // ════════════════════════════════════════════════════════
    pasteButton.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    // SECTION 7 END: Attach Drag Event Listeners
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 8 START: dragStart
    // ════════════════════════════════════════════════════════
    function dragStart(e) {
        if (e.target === pasteButton) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            wasDragged = false;
        }
    }
    // FUNCTION 8 END: dragStart
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 9 START: drag
    // ════════════════════════════════════════════════════════
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            if (Math.abs(currentX - xOffset) > 3 || Math.abs(currentY - yOffset) > 3) {
                wasDragged = true;
            }

            xOffset = currentX;
            yOffset = currentY;
            setTranslate(currentX, currentY, pasteButton);
        }
    }
    // FUNCTION 9 END: drag
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 10 START: dragEnd
    // ════════════════════════════════════════════════════════
    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }
    // FUNCTION 10 END: dragEnd
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 11 START: setTranslate
    // ════════════════════════════════════════════════════════
    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }
    // FUNCTION 11 END: setTranslate
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 12 START: showStatus
    // ════════════════════════════════════════════════════════
    function showStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.style.backgroundColor = isError
            ? 'rgba(220,53,69,0.9)'
            : 'rgba(40,167,69,0.9)';
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }
    // FUNCTION 12 END: showStatus
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 13 START: cleanupClipboardInput
    // v9.19 — All fixes integrated
    // ════════════════════════════════════════════════════════
    function cleanupClipboardInput(text) {
        if (!text) return text;

        // ── Fix 38a: AM/PM glued to capital letter (day name) → newline
        text = text.replace(/(am|pm)([A-Z])/gi, '$1\n$2');

        // ── Fix 38b: Day name glued to "to" → insert space
        text = text.replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(to)\b/gi, '$1 $2');

        // ── Fix 38c: "time to- time" → "time - time"
        text = text.replace(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*to\s*-\s*(\d)/gi, '$1 - $2');

        // ── Fix 38d: "Day to - Day" → "Day - Day"
        text = text.replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+to\s*-\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/gi, '$1 - $2');

        // ── Fix 40: Day name glued to digit or "Closed" → insert ": "
        text = text.replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(\d)/gi, '$1: $2');
        text = text.replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(closed)/gi, '$1: $2');

        // ── Fix 41: English "to" between two times → dash
        text = text.replace(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi, '$1 - $2');

        // ── Fix 42: Strip "Office/Store/Business/Opening Hours" inline
        text = text.replace(/(?:office\s+hours|store\s+hours|business\s+hours|opening\s+hours|horario)\s*:?\s*/gi, '');

        // Fix 43: Strip timezone abbreviations embedded in times
        text = text.replace(/\b(am|pm)\s+(?:EST|CST|MST|PST|EDT|CDT|MDT|PDT|GMT|UTC|IST|CET|CEST|BST|AEST|AEDT|JST|KST|SGT|HKT|ICT|WIB|WITA|WIT|AST|NST|HST|AKST|AKDT|NZST|NZDT|SAST|EAT|WAT|CAT)\b/gi, '$1');

        // Fix 44: Military 4-digit time → colon format
        text = text.replace(/\b(\d{2})(\d{2})\s*[-–]\s*(\d{2})(\d{2})\b/g, function(match, h1, m1, h2, m2) {
            var hour1 = parseInt(h1);
            var hour2 = parseInt(h2);
            if (hour1 >= 0 && hour1 <= 23 && hour2 >= 0 && hour2 <= 23 &&
                parseInt(m1) >= 0 && parseInt(m1) <= 59 && parseInt(m2) >= 0 && parseInt(m2) <= 59) {
                return h1 + ':' + m1 + '-' + h2 + ':' + m2;
            }
            return match;
        });

        // ── Fix 39: Two AM/PM times with space only → insert dash
        text = text.replace(/(\d{1,2}:\d{2}\s*(?:am|pm))\s+(\d{1,2}:\d{2}\s*(?:am|pm))/gi, '$1 - $2');

        // Step 1b: a.m. / p.m. → am / pm
        text = text.replace(/a\.m\./gi, 'am').replace(/p\.m\./gi, 'pm');

        // Step 1c: Dot times → colon times (8.00 → 8:00)
        text = text.replace(/(\d{1,2})\.(\d{2})(?=\s*[-–]|\s*$|\s*[ap]m)/gm, '$1:$2');

        // Step 1c-b: Single-digit minutes → pad with zero (13:0 → 13:00)
        text = text.replace(/(\d{1,2}):(\d)(?!\d)/g, '$1:0$2');

        // Step 1d: Normalize en-dash/em-dash between times to hyphen
        text = text.replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2');

        // Step 1e: 'Day and Day' → 'Day & Day'
        text = text.replace(/\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(\.?)\s+and\s+/gi, '$1$2 & ');

        // Step 1f: Strip 'de' between day/range and timing
        text = text.replace(/:\s*de\s+(\d)/gi, ': $1');
        text = text.replace(/\bde\s+(\d{1,2}[:\.]?\d{0,2}\s*(?:am|pm|h)?)/gi, '$1');

        // Step 1f-b: Catalan day names → English
        var catalanDays = {
            'dilluns': 'Monday', 'dimarts': 'Tuesday', 'dimecres': 'Wednesday',
            'dijous': 'Thursday', 'divendres': 'Friday', 'dissabte': 'Saturday',
            'diumenge': 'Sunday'
        };
        Object.keys(catalanDays).forEach(function(cat) {
            var re = new RegExp('\\b' + cat + '\\b', 'gi');
            text = text.replace(re, catalanDays[cat]);
        });

        // Step 1g: Spanish 'time a time' → 'time - time'
        text = text.replace(/(\d{1,2}[:\.]?\d{0,2}\s*(?:am|pm|h)?)\s+a\s+(\d{1,2}[:\.]?\d{0,2}\s*(?:am|pm|h)?)/gi, '$1 - $2');

        // Step 1h: Strip standalone 'Horario:' / 'Opening hours:' / 'Business hours:' lines
        text = text.replace(/^(?:horario|opening\s+hours|business\s+hours)\s*:\s*/gim, '');

        // Step 1i: Strip trailing 'h' from times (16:00h → 16:00)
        text = text.replace(/(\d{1,2}:\d{2})h\b/g, '$1');
        text = text.replace(/(\d{1,2})h\b(?!\s*[-–])/g, '$1:00');

        // Step 1j: Spanish single-letter day ranges (L-S, L-V, etc.)
        var spanishLetterMap = { 'L': 'Mon', 'M': 'Tue', 'X': 'Wed', 'J': 'Thu', 'V': 'Fri', 'S': 'Sat', 'D': 'Sun' };
        text = text.replace(/\b([LMXJVSD])\s*[-–]\s*([LMXJVSD])\s*:/g, function(match, s, e) {
            var start = spanishLetterMap[s.toUpperCase()];
            var end = spanishLetterMap[e.toUpperCase()];
            if (start && end) return start + '-' + end + ':';
            return match;
        });

        // Step 1k: Remove noise lines
        var noisePatterns = [
            /^hours\s*:?\s*$/i,
            /^hours\s+might\s+differ/i,
            /^suggest\s+new\s+hours/i,
            /^\(.*\)\s*$/,
            /^horario\s*$/i,
            /^we\s+are\s+open\s*:?\s*$/i
        ];
        var lines = text.split(/\r?\n/);
        lines = lines.filter(function(line) {
            var trimmed = line.trim();
            if (!trimmed) return false;
            for (var np = 0; np < noisePatterns.length; np++) {
                if (noisePatterns[np].test(trimmed)) return false;
            }
            return true;
        });
        text = lines.join('\n');

        // Step 1l: Day / timing → Day: timing & strip noise phrases
        text = text.replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s*\/\s*/gi, '$1: ');
        text = text.replace(/\.\s*We are open on some holidays.*$/gim, '');
        text = text.replace(/\.\s*Ver festivos.*$/gim, '');
        text = text.replace(/\.\s*Algunos festivos.*$/gim, '');

        // Step 1m: Split multiple day-timing pairs on same line
        text = text.replace(/((?:\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm)))\s+((?:Mo|Tu|We|Th|Fr|Sa|Su|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[a-z]*\s*[-:])/gi, '$1\n$2');

        // Step 1n: 'Day thru/through/to Day' → 'Day-Day'
        text = text.replace(/\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(\.?)\s+(?:thru|through|to)\s+(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, '$1$2-$3');

        // Step 1o: Italian 'e' / Spanish 'y' between time ranges → pipe
        text = text.replace(/(\d{1,2}:\d{2})\s+(?:e|y)\s+(\d{1,2}:\d{2})/gi, '$1|$2');

        // Step 5b: Day + TAB + timing → Day: timing
        text = text.replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\t+/gi, '$1: ');

        // ── FIX v9.19: Strip dots after day names (from multi-lang translation) ──
        // "Monday.-Friday." → "Monday-Friday", "Saturday." → "Saturday"
        text = text.replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\./gi, '$1');

        // ── FIX v9.19: Add colon when day/range followed by 2+ spaces + timing ──
        // "Monday-Friday     09:00" → "Monday-Friday: 09:00"
        text = text.replace(/\b((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*[-–]\s*(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s{2,}/gi, '$1: ');

        // Step 7: Consolidate standalone day lines with next timing line
        // ── FIX v9.19: Now handles BOTH single days AND day ranges ──
        var standaloneDayPattern = /^((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s*[-–]\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s*:?\s*$/i;
        var consolidated = [];
        var cLines = text.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l; });
        for (var ci = 0; ci < cLines.length; ci++) {
            var cLine = cLines[ci];
            if (standaloneDayPattern.test(cLine)) {
                if (ci + 1 < cLines.length && (/\d/.test(cLines[ci + 1]) || /^closed/i.test(cLines[ci + 1]))) {
                    var dayName = cLine.replace(/\s*:\s*$/, '');
                    consolidated.push(dayName + ': ' + cLines[ci + 1]);
                    ci++;
                } else {
                    consolidated.push(cLine);
                }
            } else {
                consolidated.push(cLine);
            }
        }
        text = consolidated.join('\n');

        // Step 7b: Bare timing lines → append to previous day line
        var finalLines = [];
        var fLines = text.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l; });
        for (var fi = 0; fi < fLines.length; fi++) {
            var fLine = fLines[fi];
            if (/^\d/.test(fLine) && !/monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun/i.test(fLine)) {
                if (finalLines.length > 0) {
                    finalLines[finalLines.length - 1] += ', ' + fLine;
                } else {
                    finalLines.push(fLine);
                }
            } else {
                finalLines.push(fLine);
            }
        }
        text = finalLines.join('\n');

        return text;
    }
    // FUNCTION 13 END: cleanupClipboardInput
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // SECTION 14 START: Paste Button Click Handler
    // ════════════════════════════════════════════════════════
    pasteButton.addEventListener('click', async function (e) {

        if (wasDragged) {
            wasDragged = false;
            return;
        }

        try {
            const pastedText = await navigator.clipboard.readText();

            if (!pastedText || !pastedText.trim()) {
                showStatus('Please copy timing data first, then click this button', true);
                return;
            }

            console.log('Raw clipboard:', pastedText);

            // Translate multi-lang days first
            let translatedText = translateMultiLangDays(pastedText);
            const cleanedText = cleanupClipboardInput(translatedText);
            console.log('Cleaned clipboard:', cleanedText);

            const timingsByDay = parseMultiLineTiming(cleanedText);
            console.log('Parsed timings:', timingsByDay);

            const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

            // ════════════════════════════════════════════════════════
            // SECTION 14a: Read EXISTING timings from AuditBook display elements
            // ════════════════════════════════════════════════════════

            function normalizeForCompare(timing) {
                if (!timing) return '';
                timing = timing.trim();
                if (timing === '00:00-00:00' || timing.toLowerCase() === 'closed' || timing === '') {
                    return 'CLOSED';
                }
                timing = timing.replace(/\s*\|\s*/g, '|');
                timing = timing.replace(/\s*-\s*/g, '-');
                timing = timing.replace(/\s+/g, '');
                return timing.toUpperCase();
            }

            var displayDayMap = {
                'MON': 'Mon', 'TUE': 'Tue', 'WED': 'Wed',
                'THU': 'Thu', 'FRI': 'Fri', 'SAT': 'Sat', 'SUN': 'Sun'
            };

            var timingsAreSame = true;
            var hasAnyParsedTiming = false;
            var filledFieldsCount = 0;

            dayLabels.forEach(function(label) {
                var displayId = displayDayMap[label];
                var displayElement = document.getElementById(displayId);
                var existingValue = '';
                if (displayElement) {
                    existingValue = normalizeForCompare(displayElement.textContent);
                }

                var parsedValue = '';
                if (timingsByDay[label] !== undefined && timingsByDay[label] !== '') {
                    parsedValue = normalizeForCompare(timingsByDay[label]);
                    hasAnyParsedTiming = true;
                    filledFieldsCount++;
                }

                var matches = (existingValue === parsedValue) ||
                              (existingValue === 'CLOSED' && parsedValue === '') ||
                              (existingValue === '' && parsedValue === 'CLOSED') ||
                              (existingValue === 'CLOSED' && parsedValue === 'CLOSED');

                if (parsedValue !== '' && !matches) {
                    timingsAreSame = false;
                }

                console.log(label + ': existing="' + existingValue + '" parsed="' + parsedValue + '" match=' + matches);
            });

            timingsAreSame = timingsAreSame && hasAnyParsedTiming && filledFieldsCount === 7;
            console.log('Timings are same:', timingsAreSame, '| Filled:', filledFieldsCount);

            // ════════════════════════════════════════════════════════
            // SECTION 14b: Handle SAME timings — Set Non-Actionable dropdowns
            // ════════════════════════════════════════════════════════

            if (timingsAreSame) {
                console.log('Timings are SAME — setting Non-Actionable dropdowns');

                function setDropdownValue(fieldId, value) {
                    var dropdown = document.getElementById(fieldId);
                    if (dropdown) {
                        dropdown.value = value;
                        var event = new Event('change', { bubbles: true });
                        dropdown.dispatchEvent(event);
                        console.log(fieldId + ' → ' + value);
                    }
                }

                setDropdownValue('OUTPUT_Typeofaction', 'NONACTIONABLE');
                setDropdownValue('OUTPUT_SFTags', 'Business Hours Audit Completed No Issue Identified');
                setDropdownValue('OUTPUT_NFIReason', 'NA');
                setDropdownValue('OUTPUT_NonActionableReason', 'NA');

                var blankRadio = document.querySelector('input[name="OUTPUT_MONtoFriSameTimings"][value="Blank"]');
                if (blankRadio) {
                    blankRadio.checked = true;
                    var radioEvent = new Event('change', { bubbles: true });
                    blankRadio.dispatchEvent(radioEvent);
                }

                var commentsField = document.getElementById('OUTPUT_Comments');
                if (commentsField) {
                    commentsField.value = pastedText;
                    commentsField.dispatchEvent(new Event('change', { bubbles: true }));
                }
                var commentsFieldQc1 = document.getElementById('OUTPUT_CommentsQc1');
                if (commentsFieldQc1) {
                    commentsFieldQc1.value = pastedText;
                    commentsFieldQc1.dispatchEvent(new Event('change', { bubbles: true }));
                }
                // FIX v9.19: Also fill OUTPUT_Comments1
                var commentsField1 = document.getElementById('OUTPUT_Comments1');
                if (commentsField1) {
                    commentsField1.value = pastedText;
                    commentsField1.dispatchEvent(new Event('input', { bubbles: true }));
                }

                showStatus('✓ Timings are same — No change required. Dropdowns set.');
                return;
            }

            // ════════════════════════════════════════════════════════
            // SECTION 14c: Handle DIFFERENT timings — Normal paste behavior
            // ════════════════════════════════════════════════════════

            let successCount = 0;

            dayLabels.forEach(function (label) {
                if (timingsByDay[label] !== undefined) {
                    var inputField = document.getElementById('OUTPUT_' + label);
                    if (inputField) {
                        inputField.value = timingsByDay[label];
                        inputField.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log(label + ': ' + timingsByDay[label]);
                        successCount++;
                    }
                    var inputFieldQc1 = document.getElementById('OUTPUT_' + label + 'Qc1');
                    if (inputFieldQc1) {
                        inputFieldQc1.value = timingsByDay[label];
                        inputFieldQc1.dispatchEvent(new Event('change', { bubbles: true }));
                        successCount++;
                    }
                }
            });

            // ════════════════════════════════════════════════════════
            // SECTION 14d: Fill Comments Fields
            // ════════════════════════════════════════════════════════

            var commentsField2 = document.getElementById('OUTPUT_Comments');
            if (commentsField2) {
                commentsField2.value = pastedText;
                commentsField2.dispatchEvent(new Event('change', { bubbles: true }));
            }
            var commentsFieldQc12 = document.getElementById('OUTPUT_CommentsQc1');
            if (commentsFieldQc12) {
                commentsFieldQc12.value = pastedText;
                commentsFieldQc12.dispatchEvent(new Event('change', { bubbles: true }));
            }
            // FIX v9.19: Also fill OUTPUT_Comments1
            var commentsField1b = document.getElementById('OUTPUT_Comments1');
            if (commentsField1b) {
                commentsField1b.value = pastedText;
                commentsField1b.dispatchEvent(new Event('input', { bubbles: true }));
            }

            if (successCount > 0) {
                showStatus('Filled ' + successCount + ' day(s)');
            } else {
                showStatus('No fields were filled', true);
            }

        } catch (error) {
            if (error.name === 'NotAllowedError') {
                showStatus('Clipboard access denied. Please allow clipboard permissions.', true);
            } else {
                showStatus('Error: ' + error.message, true);
                console.error('Clipboard error:', error);
            }
        }
    });
    // SECTION 14 END: Paste Button Click Handler
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // SECTION 15 START: Outdoor Button Click Handler
    // ════════════════════════════════════════════════════════
    outdoorButton.addEventListener('click', function () {

        const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
        const outdoorTiming = '00:00-23:59';

        function normalizeForCompare(timing) {
            if (!timing) return '';
            timing = timing.trim();
            if (timing === '00:00-00:00' || timing.toLowerCase() === 'closed' || timing === '') {
                return 'CLOSED';
            }
            timing = timing.replace(/\s*\|\s*/g, '|');
            timing = timing.replace(/\s*-\s*/g, '-');
            timing = timing.replace(/\s+/g, '');
            return timing.toUpperCase();
        }

        var displayDayMap = {
            'MON': 'Mon', 'TUE': 'Tue', 'WED': 'Wed',
            'THU': 'Thu', 'FRI': 'Fri', 'SAT': 'Sat', 'SUN': 'Sun'
        };

        var timingsAreSame = true;

        dayLabels.forEach(function (label) {
            var displayId = displayDayMap[label];
            var displayElement = document.getElementById(displayId);
            var existingValue = '';
            if (displayElement) {
                existingValue = normalizeForCompare(displayElement.textContent);
            }
            var parsedValue = normalizeForCompare(outdoorTiming);
            if (existingValue !== parsedValue) {
                timingsAreSame = false;
            }
        });

        // ── SAME: Already 24/7 → Non-Actionable ──
        if (timingsAreSame) {

            function setDropdownValue(fieldId, value) {
                var dropdown = document.getElementById(fieldId);
                if (dropdown) {
                    dropdown.value = value;
                    dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            setDropdownValue('OUTPUT_Typeofaction', 'NONACTIONABLE');
            setDropdownValue('OUTPUT_SFTags', 'Business Hours Audit Completed No Issue Identified');
            setDropdownValue('OUTPUT_NFIReason', 'NA');
            setDropdownValue('OUTPUT_NonActionableReason', 'NA');

            var blankRadio = document.querySelector('input[name="OUTPUT_MONtoFriSameTimings"][value="Blank"]');
            if (blankRadio) {
                blankRadio.checked = true;
                blankRadio.dispatchEvent(new Event('change', { bubbles: true }));
            }

            var commentsField = document.getElementById('OUTPUT_Comments');
            if (commentsField) {
                commentsField.value = 'Outdoor - Open 24/7';
                commentsField.dispatchEvent(new Event('change', { bubbles: true }));
            }
            var commentsFieldQc1 = document.getElementById('OUTPUT_CommentsQc1');
            if (commentsFieldQc1) {
                commentsFieldQc1.value = 'Outdoor - Open 24/7';
                commentsFieldQc1.dispatchEvent(new Event('change', { bubbles: true }));
            }
            // FIX v9.19: Also fill OUTPUT_Comments1
            var commentsField1 = document.getElementById('OUTPUT_Comments1');
            if (commentsField1) {
                commentsField1.value = 'Outdoor - Open 24/7';
                commentsField1.dispatchEvent(new Event('input', { bubbles: true }));
            }

            showStatus('✓ Already 24/7 — No change required. Dropdowns set.');
            return;
        }

        // ── DIFFERENT: Fill all days with 00:00-23:59 ──
        var successCount = 0;

        dayLabels.forEach(function (label) {
            var inputField = document.getElementById('OUTPUT_' + label);
            if (inputField) {
                inputField.value = outdoorTiming;
                inputField.dispatchEvent(new Event('change', { bubbles: true }));
                successCount++;
            }
            var inputFieldQc1 = document.getElementById('OUTPUT_' + label + 'Qc1');
            if (inputFieldQc1) {
                inputFieldQc1.value = outdoorTiming;
                inputFieldQc1.dispatchEvent(new Event('change', { bubbles: true }));
                successCount++;
            }
        });

        var commentsField2 = document.getElementById('OUTPUT_Comments');
        if (commentsField2) {
            commentsField2.value = 'Outdoor - Open 24/7';
            commentsField2.dispatchEvent(new Event('change', { bubbles: true }));
        }
        var commentsFieldQc12 = document.getElementById('OUTPUT_CommentsQc1');
        if (commentsFieldQc12) {
            commentsFieldQc12.value = 'Outdoor - Open 24/7';
            commentsFieldQc12.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // FIX v9.19: Also fill OUTPUT_Comments1
        var commentsField1b = document.getElementById('OUTPUT_Comments1');
        if (commentsField1b) {
            commentsField1b.value = 'Outdoor - Open 24/7';
            commentsField1b.dispatchEvent(new Event('input', { bubbles: true }));
        }

        if (successCount > 0) {
            showStatus('Outdoor: Filled ' + successCount + ' field(s) with 24/7');
        } else {
            showStatus('No fields were filled', true);
        }
    });
    // SECTION 15 END: Outdoor Button Click Handler
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 16 START: parseMultiLineTiming
    // ════════════════════════════════════════════════════════
    function parseMultiLineTiming(text) {
        const results = {};
        const textLower = text.toLowerCase().trim();

        // ── Case 1: Open 24/7 ──────────────────────────────────────
        if (textLower.match(/open\s*24\s*\/?\s*7|24\s*\/?\s*7/)) {
            const allDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
            allDays.forEach(day => { results[day] = '00:00-23:59'; });
            return results;
        }

        // ── Case 2: "X am - Y am 365 days" ────────────────────────
        const yearRoundMatch = text.match(/(\d{1,2}\s*(?:am|pm)?)\s*-\s*(\d{1,2}\s*(?:am|pm)?)\s*365\s*days?/i);
        if (yearRoundMatch) {
            const startTime = convertTo24Hour(yearRoundMatch[1].trim());
            const endTime = convertTo24Hour(yearRoundMatch[2].trim());
            if (startTime && endTime) {
                const timing = startTime + '-' + endTime;
                const allDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                allDays.forEach(day => { results[day] = timing; });
                return results;
            }
        }

        // ── Case 3: "Office hours" block ───────────────────────────
        if (textLower.includes('office hours')) {
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                const rangeMatch = line.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|thurs|fri|sat|sun)\s*[-–]\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|thurs|fri|sat|sun)\s*:\s*(.+)/i);
                if (rangeMatch) {
                    const startDay = rangeMatch[1].toLowerCase();
                    const endDay = rangeMatch[2].toLowerCase();
                    const timingText = rangeMatch[3].trim();

                    const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const dayMap = {
                        'sunday': 'SUN', 'monday': 'MON', 'tuesday': 'TUE',
                        'wednesday': 'WED', 'thursday': 'THU', 'thurs': 'THU',
                        'friday': 'FRI', 'saturday': 'SAT'
                    };

                    const startDayNorm = dayMap[startDay] || startDay.substring(0, 3).toUpperCase();
                    const endDayNorm = dayMap[endDay] || endDay.substring(0, 3).toUpperCase();
                    const startIdx = dayOrder.findIndex(d => dayMap[d] === startDayNorm);
                    const endIdx = dayOrder.findIndex(d => dayMap[d] === endDayNorm);
                    const formattedTiming = formatTimeString(timingText);

                    if (formattedTiming && startIdx !== -1 && endIdx !== -1) {
                        if (startIdx <= endIdx) {
                            for (let j = startIdx; j <= endIdx; j++) {
                                const dayKey = dayMap[dayOrder[j]];
                                if (dayKey) results[dayKey] = formattedTiming;
                            }
                        }
                    }
                    continue;
                }

                const dailyMatch = line.match(/(?:open\s+)?daily\s*:?\s*(.+)/i);
                if (dailyMatch) {
                    const formattedTiming = formatTimeString(dailyMatch[1].trim());
                    if (formattedTiming !== undefined) {
                        var allDaysDaily = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                        for (var dd = 0; dd < allDaysDaily.length; dd++) {
                            results[allDaysDaily[dd]] = formattedTiming;
                        }
                    }
                    continue;
                }

                var singleLetterMatch17 = line.match(/^([SMTWF])\s+(.+)/i);
                if (singleLetterMatch17) {
                    var letterTiming17 = formatTimeString(singleLetterMatch17[2].trim());
                    if (letterTiming17 !== undefined) {
                        if (!results._slPairs) results._slPairs = [];
                        results._slPairs.push({ letter: singleLetterMatch17[1].toUpperCase(), timing: letterTiming17 });
                    }
                    continue;
                }

                const singleDayMatch = line.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|thurs|fri|sat|sun)\s*:\s*(.+)/i);
                if (singleDayMatch) {
                    const dayMap2 = {
                        'monday': 'MON', 'mon': 'MON',
                        'tuesday': 'TUE', 'tue': 'TUE',
                        'wednesday': 'WED', 'wed': 'WED',
                        'thursday': 'THU', 'thu': 'THU', 'thurs': 'THU',
                        'friday': 'FRI', 'fri': 'FRI',
                        'saturday': 'SAT', 'sat': 'SAT',
                        'sunday': 'SUN', 'sun': 'SUN'
                    };
                    const dayKey = dayMap2[singleDayMatch[1].toLowerCase()];
                    const formattedTiming = formatTimeString(singleDayMatch[2].trim());
                    if (dayKey && formattedTiming !== undefined) {
                        results[dayKey] = formattedTiming;
                    }
                }
            }

            // Resolve single-letter day assignments
            if (results._slPairs) {
                if (results._slPairs.length === 7) {
                    var weekOrder17 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                    for (var sl = 0; sl < 7; sl++) {
                        results[weekOrder17[sl]] = results._slPairs[sl].timing;
                    }
                } else {
                    var tCount = 0;
                    var sCount = 0;
                    for (var sl2 = 0; sl2 < results._slPairs.length; sl2++) {
                        var pair = results._slPairs[sl2];
                        if (pair.letter === 'M') { results.MON = pair.timing; }
                        else if (pair.letter === 'W') { results.WED = pair.timing; }
                        else if (pair.letter === 'F') { results.FRI = pair.timing; }
                        else if (pair.letter === 'T') {
                            if (tCount === 0) { results.TUE = pair.timing; tCount++; }
                            else { results.THU = pair.timing; }
                        }
                        else if (pair.letter === 'S') {
                            if (sCount === 0) { results.SUN = pair.timing; sCount++; }
                            else { results.SAT = pair.timing; }
                        }
                    }
                }
                delete results._slPairs;
            }

            return results;
        }

        // ── Case 3b: "Daily" / "Open Daily" standalone ─────────────
        const dailyStandalone = text.match(/(?:open\s+)?daily\s*:?\s*(.+)/i);
        if (dailyStandalone && text.split('\n').length <= 2) {
            const formattedTiming = formatTimeString(dailyStandalone[1].trim());
            if (formattedTiming !== undefined) {
                var allDaysStandalone = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                for (var ds = 0; ds < allDaysStandalone.length; ds++) {
                    results[allDaysStandalone[ds]] = formattedTiming;
                }
                return results;
            }
        }

        // ── Case 4: Single-line day range ──────────────────────────
        // FIX v9.19: Process remaining lines after matching the range
        const singleLineRange = text.match(/(mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)\s*[-–]\s*(mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)\s*:\s*(.+)/i);
        if (singleLineRange && text.split('\n').length <= 3) {
            var dayMap4 = {
                'monday': 'MON', 'mon': 'MON',
                'tuesday': 'TUE', 'tue': 'TUE',
                'wednesday': 'WED', 'wed': 'WED',
                'thursday': 'THU', 'thu': 'THU',
                'friday': 'FRI', 'fri': 'FRI',
                'saturday': 'SAT', 'sat': 'SAT',
                'sunday': 'SUN', 'sun': 'SUN'
            };
            var dayOrder4 = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            var startDay4 = singleLineRange[1].toLowerCase();
            var endDay4 = singleLineRange[2].toLowerCase();
            var timingText4 = singleLineRange[3].trim();
            var startDayNorm4 = dayMap4[startDay4] || startDay4.substring(0, 3).toUpperCase();
            var endDayNorm4 = dayMap4[endDay4] || endDay4.substring(0, 3).toUpperCase();
            var startIdx4 = dayOrder4.findIndex(function(d) { return dayMap4[d] === startDayNorm4; });
            var endIdx4 = dayOrder4.findIndex(function(d) { return dayMap4[d] === endDayNorm4; });
            var formattedTiming4 = formatTimeString(timingText4);

            if (formattedTiming4 && startIdx4 !== -1 && endIdx4 !== -1) {
                if (startIdx4 <= endIdx4) {
                    for (var j4 = startIdx4; j4 <= endIdx4; j4++) {
                        var dayKey4 = dayMap4[dayOrder4[j4]];
                        if (dayKey4) results[dayKey4] = formattedTiming4;
                    }
                }
            }

            // FIX v9.19: Process remaining lines (e.g., Saturday, Sunday)
            var remainLines = text.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l; });
            for (var r = 0; r < remainLines.length; r++) {
                if (remainLines[r] === singleLineRange[0]) continue;
                var parsedLine = parseTimingLine(remainLines[r]);
                if (parsedLine && parsedLine.days) {
                    for (var d = 0; d < parsedLine.days.length; d++) {
                        if (parsedLine.timing !== undefined) {
                            results[parsedLine.days[d]] = parsedLine.timing;
                        }
                    }
                }
            }

            return results;
        }

        // ── Case 5: All 7 days "Open 24 hours" ────────────────────
        const lines5 = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        const allOpen24 = lines5.every(line =>
            line.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i) &&
            line.match(/open\s*24\s*hours?/i)
        );
        if (allOpen24 && lines5.length >= 5) {
            const allDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
            allDays.forEach(day => { results[day] = '00:00-23:59'; });
            return results;
        }

        // ── Case 6: Single-letter days ─────────────────────────────
        const singleLetterPattern = /^[MTWFS]\s+\d{1,2}:\d{2}/m;
        if (singleLetterPattern.test(text)) {
            const singleLetterMap = { 'M': 'MON', 'T': 'TUE', 'W': 'WED', 'F': 'FRI', 'S': 'SAT' };
            const lines6 = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
            lines6.forEach(line => {
                const match = line.match(/^([MTWFS])\s+(.+)/);
                if (match) {
                    const dayKey = singleLetterMap[match[1]];
                    if (dayKey) {
                        results[dayKey] = formatTimeString(match[2].trim());
                    }
                }
            });
            return results;
        }

        // ── Case 7: Multi-line format (day on one line, timing on next) ──
        const multiLineCheck = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        const hasDayOnlyLines = multiLineCheck.some(line =>
            /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s*:?\s*$/i.test(line)
        );

        if (hasDayOnlyLines) {
            const dayMap7 = {
                'monday': 'MON', 'mon': 'MON',
                'tuesday': 'TUE', 'tue': 'TUE',
                'wednesday': 'WED', 'wed': 'WED',
                'thursday': 'THU', 'thu': 'THU',
                'friday': 'FRI', 'fri': 'FRI',
                'saturday': 'SAT', 'sat': 'SAT',
                'sunday': 'SUN', 'sun': 'SUN'
            };
            let currentDay = null;
            multiLineCheck.forEach(line => {
                const dayMatch = line.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s*:?\s*$/i);
                if (dayMatch) {
                    currentDay = dayMap7[dayMatch[1].toLowerCase()];
                } else if (currentDay) {
                    results[currentDay] = formatTimeString(line);
                    currentDay = null;
                }
            });
            return results;
        }

        // ── Case 8: General line-by-line ───────────────────────────
        const lines8 = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        lines8.forEach(line => {
            const parsed = parseTimingLine(line);
            if (parsed) {
                parsed.days.forEach(day => {
                    if (parsed.timing !== undefined) {
                        results[day] = parsed.timing;
                    }
                });
            }
        });

        return results;
    }
    // FUNCTION 16 END: parseMultiLineTiming
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 17 START: parseTimingLine
    // ════════════════════════════════════════════════════════
    function parseTimingLine(line) {
        if (!line || !line.trim()) return null;
        line = line.trim();

        var dayMapPTL = {
            'monday': 'MON', 'mon': 'MON',
            'tuesday': 'TUE', 'tue': 'TUE', 'tues': 'TUE',
            'wednesday': 'WED', 'wed': 'WED',
            'thursday': 'THU', 'thu': 'THU', 'thur': 'THU', 'thurs': 'THU',
            'friday': 'FRI', 'fri': 'FRI',
            'saturday': 'SAT', 'sat': 'SAT',
            'sunday': 'SUN', 'sun': 'SUN'
        };

        var dayOrderPTL = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

        // Strategy 1: Day range (e.g., "Mon-Fri: 9:00 AM - 5:00 PM")
        var rangeMatch = line.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\s*[-–]\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\s*:?\s*(.+)/i);
        if (rangeMatch) {
            var rStartDay = dayMapPTL[rangeMatch[1].toLowerCase()];
            var rEndDay = dayMapPTL[rangeMatch[2].toLowerCase()];
            var rTimingText = rangeMatch[3].trim();
            var rFormatted = formatTimeString(rTimingText);

            if (rStartDay && rEndDay && rFormatted !== undefined) {
                var rDays = [];
                var rStartIdx = dayOrderPTL.indexOf(rStartDay);
                var rEndIdx = dayOrderPTL.indexOf(rEndDay);

                if (rStartIdx !== -1 && rEndIdx !== -1) {
                    if (rStartIdx <= rEndIdx) {
                        for (var ri = rStartIdx; ri <= rEndIdx; ri++) {
                            rDays.push(dayOrderPTL[ri]);
                        }
                    } else {
                        // Wrap around (e.g., Fri-Mon)
                        for (var rw = rStartIdx; rw < 7; rw++) {
                            rDays.push(dayOrderPTL[rw]);
                        }
                        for (var rw2 = 0; rw2 <= rEndIdx; rw2++) {
                            rDays.push(dayOrderPTL[rw2]);
                        }
                    }
                }

                return { days: rDays, timing: rFormatted };
            }
        }

        // Strategy 2: Single day (e.g., "Monday: 9:00 AM - 5:00 PM")
        var singleDayMatch = line.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\s*:?\s*(.+)/i);
        if (singleDayMatch) {
            var sDayKey = dayMapPTL[singleDayMatch[1].toLowerCase()];
            var sTimingText = singleDayMatch[2].trim();
            var sFormatted = formatTimeString(sTimingText);

            if (sDayKey && sFormatted !== undefined) {
                return { days: [sDayKey], timing: sFormatted };
            }
        }

        // Strategy 3: Multi-day with ampersand (e.g., "Mon & Tue: 9-5")
        var ampMatch = line.match(/^((?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\s*[&,]\s*)+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun))\s*:?\s*(.+)/i);
        if (ampMatch) {
            var ampParts = ampMatch[1].split(/\s*[&,]\s*/);
            var ampTiming = formatTimeString(ampMatch[2].trim());
            var ampDays = [];

            for (var ai = 0; ai < ampParts.length; ai++) {
                var ampDk = dayMapPTL[ampParts[ai].trim().toLowerCase()];
                if (ampDk) ampDays.push(ampDk);
            }

            if (ampDays.length > 0 && ampTiming !== undefined) {
                return { days: ampDays, timing: ampTiming };
            }
        }

        return null;
    }
    // FUNCTION 17 END: parseTimingLine
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 18 START: formatTimeString
    // ════════════════════════════════════════════════════════
    function formatTimeString(text) {
        if (!text) return undefined;
        text = text.trim();

        // Closed patterns
        if (/^(closed|cerrado|chiuso|geschlossen|fermé|fechado|tancat|ferme)/i.test(text)) {
            return 'closed';
        }

        // Open 24 hours
        if (/24\s*hours?|24\s*h\b|24\s*hrs?\b|open\s+24/i.test(text)) {
            return '00:00-23:59';
        }

        // Extract all time ranges
        var ftsRanges = [];
        var ftsPattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
        var ftsMatch;

        while ((ftsMatch = ftsPattern.exec(text)) !== null) {
            var ftsStartRaw = ftsMatch[1].trim();
            var ftsEndRaw = ftsMatch[2].trim();

            var ftsStartHas = /am|pm/i.test(ftsStartRaw);
            var ftsEndHas = /am|pm/i.test(ftsEndRaw);

            // FIX v9.19: AM/PM inheritance — compare HOURS ONLY
            if (!ftsStartHas && ftsEndHas) {
                var ftsPeriod = ftsEndRaw.match(/(am|pm)/i)[1];
                var ftsStartHr = parseInt(ftsStartRaw.match(/(\d{1,2})/)[1]);
                var ftsEndHr = parseInt(ftsEndRaw.match(/(\d{1,2})/)[1]);
                if (ftsStartHr > ftsEndHr && ftsPeriod.toLowerCase() === 'pm') {
                    ftsStartRaw += ' am';
                } else {
                    ftsStartRaw += ' ' + ftsPeriod;
                }
            }

            if (!ftsEndHas && ftsStartHas) {
                var ftsPeriod2 = ftsStartRaw.match(/(am|pm)/i)[1];
                ftsEndRaw += ' ' + ftsPeriod2;
            }

            var ftsStart24 = convertTo24Hour(ftsStartRaw);
            var ftsEnd24 = convertTo24Hour(ftsEndRaw);

            if (ftsStart24 && ftsEnd24) {
                var ftsEndH = parseInt(ftsEnd24.split(':')[0]);
                var ftsStartH = parseInt(ftsStart24.split(':')[0]);

                // FIX v9.19: Midnight boundary
                if (ftsEnd24 === '00:00' && ftsStart24 !== '00:00') {
                    ftsRanges.push(ftsStart24 + '-23:59');
                }
                else if (ftsEndH < ftsStartH && ftsEnd24 !== '00:00') {
                    ftsRanges.push('00:00-' + ftsEnd24 + '|' + ftsStart24 + '-23:59');
                }
                else {
                    ftsRanges.push(ftsStart24 + '-' + ftsEnd24);
                }
            }
        }

        if (ftsRanges.length === 0) {
            return undefined;
        }

        // Validate: Total open minutes must be >= 180 (3 hours)
        var ftsTotalMins = 0;
        var ftsAllSegs = ftsRanges.join('|').split('|');
        for (var fs = 0; fs < ftsAllSegs.length; fs++) {
            var ftsSegParts = ftsAllSegs[fs].split('-');
            if (ftsSegParts.length === 2) {
                var ftsStartArr = ftsSegParts[0].split(':');
                var ftsEndArr = ftsSegParts[1].split(':');
                var ftsStartMins = parseInt(ftsStartArr[0]) * 60 + parseInt(ftsStartArr[1]);
                var ftsEndMins = parseInt(ftsEndArr[0]) * 60 + parseInt(ftsEndArr[1]);
                if (ftsEndMins <= ftsStartMins) ftsEndMins += 1440;
                ftsTotalMins += (ftsEndMins - ftsStartMins);
            }
        }

        if (ftsTotalMins < 180) {
            return '';
        }

        return ftsRanges.join('|');
    }
    // FUNCTION 18 END: formatTimeString
    // ════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════
    // FUNCTION 19 START: convertTo24Hour
    // v9.19 — Handles hour > 12 with AM/PM, and 24:00
    // ════════════════════════════════════════════════════════
    function convertTo24Hour(timeStr) {
        if (!timeStr) return null;
        var c24cleaned = timeStr.trim().toLowerCase().replace(/\s+/g, '');

        // FIX v9.19: Handle "24:00" → end of day
        if (/^24:00$/.test(c24cleaned)) {
            return '23:59';
        }
        if (/^24:\d{2}$/.test(c24cleaned)) {
            return '23:59';
        }

        // Match HH:MM am/pm
        var c24match1 = c24cleaned.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
        if (c24match1) {
            var c24hour1 = parseInt(c24match1[1]);
            var c24mins1 = c24match1[2];
            var c24period1 = c24match1[3];

            // FIX v9.19: If hour > 12, already 24-hour — ignore AM/PM
            if (c24hour1 > 12) {
                return (c24hour1 < 10 ? '0' : '') + c24hour1 + ':' + c24mins1;
            }
            if (c24period1 === 'am' && c24hour1 === 12) c24hour1 = 0;
            if (c24period1 === 'pm' && c24hour1 !== 12) c24hour1 += 12;
            return (c24hour1 < 10 ? '0' : '') + c24hour1 + ':' + c24mins1;
        }

        // Match H am/pm (no minutes)
        var c24match2 = c24cleaned.match(/^(\d{1,2})(am|pm)$/);
        if (c24match2) {
            var c24hour2 = parseInt(c24match2[1]);
            var c24period2 = c24match2[2];

            // FIX v9.19: If hour > 12, already 24-hour — ignore AM/PM
            if (c24hour2 > 12) {
                return (c24hour2 < 10 ? '0' : '') + c24hour2 + ':00';
            }
            if (c24period2 === 'am' && c24hour2 === 12) c24hour2 = 0;
            if (c24period2 === 'pm' && c24hour2 !== 12) c24hour2 += 12;
            return (c24hour2 < 10 ? '0' : '') + c24hour2 + ':00';
        }

        // Match HH:MM (24-hour, no AM/PM)
        var c24match3 = c24cleaned.match(/^(\d{1,2}):(\d{2})$/);
        if (c24match3) {
            var c24hour3 = parseInt(c24match3[1]);
            var c24mins3 = c24match3[2];
            return (c24hour3 < 10 ? '0' : '') + c24hour3 + ':' + c24mins3;
        }

        // Match bare hour (no minutes, no AM/PM)
        var c24match4 = c24cleaned.match(/^(\d{1,2})$/);
        if (c24match4) {
            var c24hour4 = parseInt(c24match4[1]);
            return (c24hour4 < 10 ? '0' : '') + c24hour4 + ':00';
        }

        return null;
    }
    // FUNCTION 19 END: convertTo24Hour
    // ════════════════════════════════════════════════════════

})();

