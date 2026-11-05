// Английская версия демо-материалов (см. lib/demo-content.ts). Те же шаблоны по типу товара.

import type { DemoKind, DemoTexts } from "@/lib/demo-content";

export function textsEn(kind: DemoKind, name: string): DemoTexts {
  switch (kind) {
    case "integrated":
      return {
        highlights: [
          "Every unit is listened to on the test bench for at least two hours with different speakers.",
          "A neutral sound with a firm bass — no embellishment and no grain in the treble.",
          "Suits bookshelf and floorstanding speakers with a sensitivity from 86 dB.",
          "Two years of warranty on the electronics, then service at the cost of parts.",
        ],
        videoTitle: `${name}: overview and first power-on`,
        duration: "7:42",
        review: [
          `I build the ${name} the same way I would for myself: the power supply first, then the gain stages, and only after a run on the test bench — the case. I listen to every unit for at least two hours with different speakers.`,
          "The sound is neutral, with a firm bass and no grain in the treble. The amplifier does not try to flatter the recording: a badly mixed album will sound like one, but good recordings open up completely.",
          "It works best with bookshelf and floorstanding speakers from 86 dB of sensitivity. For very demanding 4 Ω speakers, take the bigger model.",
        ],
        setup: [
          "Unpack the amplifier and let it stand at room temperature for two hours if it travelled in winter.",
          "Connect the speakers: red terminal to red, black to black. Make sure no strand of the cable touches the neighbouring terminal.",
          "Connect your sources to the line inputs. A turntable without a phono stage goes only to the PHONO input, if there is one.",
          "Turn the volume all the way down, switch the amplifier on and wait until the protection light goes out (about 5 seconds).",
          "Choose the input and raise the volume gradually.",
        ],
        care: [
          { title: "Ventilation", text: "Leave at least 10 cm of free space above the case. Do not put other devices on top of the amplifier." },
          { title: "Dust", text: "Wipe the case with a dry microfibre cloth once a month. No liquids or sprays — especially near the knobs." },
          { title: "Volume knob", text: "If it crackles when you turn it, get in touch — cleaning it takes 15 minutes." },
          { title: "Maintenance", text: "Every 3–5 years the power supply capacitors are worth checking. Free for our customers." },
        ],
        faq: [
          { question: "Does the case get warm?", answer: "Yes, moderately — up to 40–45 °C when you listen loud. That is normal for a class AB amplifier." },
          { question: "Can I connect a TV?", answer: "Yes, through the TV's line output (RCA) or through an external DAC with an optical input." },
          { question: "What is the warranty?", answer: "Two years on the electronics. After that we service it at the cost of parts." },
        ],
      };
    case "tube":
      return {
        highlights: [
          "The maker winds the output transformers himself for this circuit.",
          "A lively, spacious midrange: voices sound as if the singer is in the room.",
          "The tube cage is removable — keep it on if you have children or pets.",
          "Matched replacement tube pairs are always in stock at the workshop.",
        ],
        videoTitle: `${name}: how I build it — from the chassis to the first sound`,
        duration: "14:05",
        review: [
          `The ${name} is a circuit I spent several years refining. I wind the output transformers myself, so every unit is slightly different — within half a decibel, which you cannot hear.`,
          "The tube sound here is not about warmth for its own sake: the midrange is lively and spacious, and voices sound as if the singer is in the room. The bass is tight but not heavy — for pipe organ, a transistor amplifier is a better choice.",
          "Be sure to pick high-sensitivity speakers. If in doubt, write to me and I will suggest a pair I have listened to myself.",
        ],
        setup: [
          "Fit the tubes as marked on the chassis: output tubes in the back row, drivers in the front. Hold a tube by its base, not the glass.",
          "Connect the speakers to the output with the matching impedance (4 or 8 Ω).",
          "Never switch the amplifier on without speakers connected — this can damage the output transformers.",
          "After switching on, wait 1–2 minutes for the tubes to warm up before raising the volume.",
          "The sound opens up over the first 50 hours — this is normal for new tubes.",
        ],
        care: [
          { title: "Tubes", text: "Output tubes last 3,000–5,000 hours. When the sound gets duller or a hum appears, replace the pair. We have matched pairs." },
          { title: "Bias", text: "Check the bias current every six months as described in the manual. If that is inconvenient, we will do it during maintenance." },
          { title: "Safety", text: "Do not touch the tubes while they are working or for 15 minutes after switching off — they are very hot. Keep the cage on if you have children or pets." },
          { title: "Placement", text: "Only on an open shelf — a tube amplifier needs free air above it." },
        ],
        faq: [
          { question: "How much does a tube replacement cost?", answer: "It depends on the type. A matched pair of output tubes from us starts at UAH 2,500, and fitting is free." },
          { question: "I hear a slight hum in the speakers — is it a fault?", answer: "A barely audible hum up close is normal. If you can hear it from your listening seat, write to us." },
          { question: "Can I leave it on for a long time?", answer: "You can, but it uses up tube life. Switch it off when you will not be listening for more than an hour." },
        ],
      };
    case "bookshelf":
    case "floor":
      return {
        highlights: [
          "The cabinets are glued and sanded by hand.",
          "Drivers are matched in pairs by measurement — channels differ by no more than 0.5 dB.",
          kind === "floor" ? "Full bass without a subwoofer, even in a large room." : "Deeper bass than you would expect from this size.",
          "The cabinet can be ordered in another wood veneer or painted.",
        ],
        videoTitle: `${name}: placement in the room and a listening session`,
        duration: "9:18",
        review: [
          `I glue and sand the ${name} cabinets by hand and match the drivers in pairs by measurement — the left and right speakers differ by no more than 0.5 dB.`,
          kind === "floor"
            ? "Floorstanding speakers give full bass without a subwoofer, even in a large room. The stage is wide, and instruments separate well in depth."
            : "For their size the speakers sound grown-up: the bass is deeper than you would expect, and voices are clean and free of harshness. They open up best on stands.",
          "They work well with both transistor and tube amplifiers — the main thing is to have enough power in reserve.",
        ],
        setup: [
          "Place the speakers at the same distance from the listener, so that you form an equilateral triangle.",
          kind === "floor"
            ? "Move the speakers 40–60 cm away from the back wall. Closer to the wall gives more bass, but it may boom."
            : "Put the speakers on stands so that the tweeter is at ear level when seated (usually 60–70 cm stands).",
          "Toe the speakers in slightly towards the listener — by 5–10 degrees. Experiment: the stage should come together in the centre.",
          "Connect the cables with the right polarity: “+” to “+”, “−” to “−”.",
          "The drivers break in over the first 30–50 hours — the sound will get softer and deeper.",
        ],
        care: [
          { title: "Cabinet", text: "Wipe natural veneer with a dry cloth. Once a year you can treat it with a silicone-free furniture wax." },
          { title: "Drivers", text: "Do not touch the tweeter domes — they are very thin. Remove dust with a soft brush." },
          { title: "Volume", text: "If you hear rasping or distortion, turn the volume down. Speakers are most often damaged not by a powerful amplifier but by an overdriven weak one." },
          { title: "Sunlight", text: "Keep the speakers out of direct sunlight — the veneer fades and the driver surrounds age faster." },
        ],
        faq: [
          { question: "Do I need a subwoofer?", answer: kind === "floor" ? "For music — no. For films with effects you can add one." : "In a room up to 20 m² — no. In a larger room or for films you can add one." },
          { question: "Which amplifier will suit them?", answer: "From 30 W per channel. Tell me what you already have, and I will say whether it is worth changing." },
          { question: "Can I order another colour?", answer: "Yes, a cabinet in another wood veneer or painted — it takes 4–6 weeks to make." },
        ],
      };
    case "turntable":
      return {
        highlights: [
          "A heavy plinth damps vibration — the turntable can stand next to the speakers.",
          "The cartridge is already mounted and aligned on the test bench.",
          "Steady speed, no wavering on long piano notes.",
          "A spare belt is included.",
        ],
        videoTitle: `${name}: setting up the tonearm in 10 minutes`,
        duration: "10:27",
        review: [
          `I build the ${name} on a heavy plinth that damps vibration: the turntable can stand even next to the speakers.`,
          "The cartridge is already mounted and aligned — tracking force, angle and anti-skating are set on the test bench. All that is left is to put on a record.",
          "The sound is steady, with no wavering on long piano notes. A good choice both for a first turntable and for a collection.",
        ],
        setup: [
          "Put the turntable on a level, stable surface and level it with a spirit level — this matters for the tonearm.",
          "Remove the transport locks (marked in red) and fit the platter and the mat.",
          "Fit the tonearm counterweight and set the tracking force to the cartridge's specification (usually 1.8–2.0 g).",
          "Connect the turntable to the PHONO input of your amplifier, or to a line input if the built-in phono stage is switched on.",
          "Connect the ground wire to the amplifier's GND terminal — otherwise a background hum is possible.",
        ],
        care: [
          { title: "Stylus", text: "Clean the stylus with a special brush from back to front — never sideways. A stylus lasts about 800–1,000 hours." },
          { title: "Records", text: "Go over a record with a carbon-fibre brush before playing. Store records upright, in inner sleeves." },
          { title: "Belt", text: "On a belt-drive turntable, replace the belt every 2–3 years. A spare is included." },
          { title: "Lid", text: "Lift or remove the lid while listening — it passes vibration from the speakers." },
        ],
        faq: [
          { question: "What is a phono stage, and do I need one?", answer: "The signal from the cartridge is very weak and needs amplification and correction. If your amplifier has no PHONO input, you need a built-in or separate phono stage." },
          { question: "Can I change the cartridge?", answer: "Yes, the tonearm takes a standard ½-inch mount. We will fit and set it up for free." },
          { question: "Why does a record play too fast or too slow?", answer: "Check the 33/45 switch and the belt tension. If that does not help, write to us." },
        ],
      };
    case "cable":
      return {
        highlights: [
          "Soldered by hand with silver-bearing solder.",
          "Every cable is checked on the test bench: resistance, capacitance, shield continuity.",
          "Gold-plated contacts do not oxidise for years.",
          "Any length from 0.3 to 5 m at no extra charge.",
        ],
        videoTitle: `${name}: what the cable is made of and how it is soldered`,
        duration: "5:31",
        review: [
          `I solder every ${name} by hand with silver-bearing solder and check it on the test bench: resistance, capacitance and shield continuity.`,
          "I do not promise magic, but a good cable with reliable plugs removes interference and crackle, and gold-plated contacts do not oxidise for years.",
          "I can make a cable of the length you need — from 0.3 to 5 m — at no extra charge for a non-standard length.",
        ],
        setup: [
          "Switch both devices off before connecting.",
          "The red plug is the right channel, the white (or blue) one is the left.",
          "Push the plug all the way in, straight. Do not pull the cable by the wire — hold the plug body.",
          "Route interconnects away from power cables — this reduces interference.",
        ],
        care: [
          { title: "Bends", text: "Do not bend the cable at a sharp angle — the minimum bend radius is 5 cm." },
          { title: "Contacts", text: "Once a year, wipe the plugs with an alcohol wipe — both on the cable and on the equipment sockets." },
          { title: "Storage", text: "Coil it in loops at least 20 cm across, without twisting." },
        ],
        faq: [
          { question: "Is there a difference from an ordinary cable?", answer: "The biggest difference is in contact reliability and shielding. On long runs and next to power cables it is audible." },
          { question: "What length should I take?", answer: "The shortest that is enough, with a little slack for moving things around." },
        ],
      };
  }
}

export const AUTHORS_EN = [
  ["Oleksandr", "Kyiv"],
  ["Mariia", "Lviv"],
  ["Andrii", "Dnipro"],
  ["Iryna", "Odesa"],
  ["Taras", "Vinnytsia"],
  ["Nataliia", "Kharkiv"],
  ["Bohdan", "Ivano-Frankivsk"],
  ["Olena", "Poltava"],
] as const;

export const REVIEW_TEXTS_EN: Record<DemoKind, string[]> = {
  integrated: [
    "I replaced my old receiver — the difference is like radio versus a live concert. The maker helped me match it to my speakers.",
    "Nicely built, the knobs turn firmly, nothing hums. Bluetooth is handy for background music.",
    "I have been listening every evening for six months with no complaints. Fast delivery and solid packaging.",
  ],
  tube: [
    "My first time with tubes — and there is no going back. The voices are right in the room.",
    "The maker called me personally and explained how to fit the tubes. You rarely see that.",
    "It looks like a work of art, especially in the evening. The sound is warm but not woolly.",
  ],
  bookshelf: [
    "I did not expect such bass from small speakers. They sit on stands in my study — perfect.",
    "The veneer is stunning in person; photos do not do it justice. The pair is perfectly matched, the stage is even.",
    "I paired them with a tube amplifier on the maker's advice — a great match.",
  ],
  floor: [
    "In a 30 m² living room the bass is plenty without a subwoofer. A very precise stage.",
    "I spent a long time choosing between several models; these won by ear. The maker let me come and listen.",
    "Well-built cabinets, nothing resonates even at volume.",
  ],
  turntable: [
    "Everything is set up out of the box — I put on a record and listen. Perfect for a beginner.",
    "Steady speed, no wavering at all. My collection sounds new again.",
    "Heavy, solid, looks great on the rack. Thank you for the detailed instructions!",
  ],
  cable: [
    "It got rid of the crackle I had with the old cable. The plugs fit snugly.",
    "Neat soldering, nice braiding. They made the length I needed in two days.",
    "Very good quality for the money. I bought another set.",
  ],
};
