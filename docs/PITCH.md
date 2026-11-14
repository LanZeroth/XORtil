# Harmattan: presentation script (Abdullah Shittu, team XORTil)

About 3 minutes. Speak slowly. Each **[Slide]** marks when to move to the next slide.

## [Slide 1: Title]
Good morning, judges. My name is Abdullah Shittu, and I'm presenting for team XORTil.
Our project is called **Harmattan**. We named it after the dry wind that blows across Nigeria every year, because that is also when Nigeria burns.
Our challenge is *Harmonization of MODIS and VIIRS Hot Spots*.
In simple words, the question we answer is: **when, and where, does Nigeria burn?**

## [Slide 2: The problem]
Every dry season, bush fires and farm fires spread across Nigeria. They destroy crops, homes and forests, and fill the air with smoke.
NASA satellites have watched these fires from space since the year 2000. That's 25 years of records.
But there's a problem. In 2012 a newer satellite arrived with sharper eyes. It sees smaller fires, so it counts about **five times more** fire spots than the old one.
Both satellites are accurate, but they measure differently. If you join their records, it looks like fires suddenly exploded in 2012, and **that never happened.**
So until now, nobody could get one clear 25-year answer.

## [Slide 3: Our idea]
Our idea was to make both satellites tell the same story. We did it in three steps.
**One:** we cut Nigeria into small squares of about 10 km, and for each day we ask a simple question: was there fire here, yes or no? That way one fire can't be counted twenty times.
**Two:** both satellites flew together for ten years, so we compared them side by side. The new one marks about four burning squares for every one the old one marks.
**Three:** we corrected the new satellite to match, and then we tested it on four years we had kept hidden.
Before, the new satellite showed **four times more** fire. After our correction, the two differ by only **four percent**.
Now we have **one trustworthy fire record, from 2000 to today.**

## [Slide 4: What you get]
On that record we built a web app. This is the **fire clock**.
Each ring is one year. 2000 is in the centre and today is on the outside, with January at the top.
Bright means lots of fire. You can see a bright band near the top every single year. That's the dry season, returning like clockwork.
Below is the same data as a calendar: one row per year, one column per day.

## [Slide 5: The danger time]
From this, the app finds the **danger window** automatically.
For Nigeria, it runs from **14 December to 13 February**, and two out of every three fires of the year happen in those nine weeks. The worst time is around **11 January**.
It also gives a weekly alert. Right now, this week is **"Extreme"**: more fire than in 95 percent of past years for this time of year.
And it works for each of the **37 states**, or any area you draw on the map.

## [Slide 6: Who it helps]
Who does this help?
**Fire and emergency services** know when and where to get ready.
**Farmers and land managers** can plan safer burning and firebreaks before each state's danger window.
**Scientists and government** get a trustworthy 25-year record. For example, it shows burning in Nigeria is down about 27 percent since the mid-2000s.
And everything is built only from **free, open NASA satellite data**: more than six million fire detections.

## [Slide 7: Try it]
You can open it on your phone right now with this QR code. It's free and needs no login.
Next, we want to send **weekly SMS fire alerts in Hausa, Yoruba, Igbo and Pidgin**, and expand to every country in Africa, because the same method works anywhere.
Harmattan turns 25 years of space data into decisions on the ground.
**Thank you.** I'm happy to take your questions.

---

## Live demo (if they let you show the app, ~30 seconds)
1. Open **lanzeroth.github.io/XORtil** and click **"Enter the fire calendar"**. Say: *"The globe flies into Nigeria, and this time-lapse shows 25 years of burning, month by month."*
2. Choose a state from the dropdown (for example, **Niger** or your judges' home state). Say: *"Every chart updates for this state: its own danger window and its own weekly alert."*
3. Click the **Harmonization** tab. Say: *"Here's the proof: grey is the raw new satellite, and orange is after our correction, sitting on top of the old satellite."*

## Likely questions and simple answers
**"Were the satellites wrong?"**
No. Both are accurate. They just measure differently, so their records couldn't be joined. We made them consistent.

**"How do you know your correction works?"**
We worked out the correction using 2012 to 2021 only, then tested it on 2022 to 2025, years it had never seen. The difference dropped from about four times to four percent.

**"Why squares instead of counting fires?"**
The sharp satellite can see one fire as many small dots. Asking "was this square burning today, yes or no" stops one fire being counted many times, so both satellites are counted fairly.

**"Why does it matter if the old satellite is still working?"**
The old satellites are near the end of their life. Soon only the new type will be left. Our correction lets the 25-year record continue without a fake jump.

**"Is 'Extreme' this week definitely true?"**
It's an early-warning signal from near-real-time data, so treat it as a guide, not a final number. The full archive confirms it later.

**"Does it measure how much land burned?"**
Not exactly. It measures how often and how widely fires are seen. Burned area is a good next step.

**"What's new compared with NASA's own fire map?"**
NASA's map shows fires on a given day. Harmattan shows the **pattern over 25 years**: when the danger season starts, how this year compares with normal, and whether it's getting better or worse, for every state.

**"Did you use AI?"**
Yes. I used an AI coding assistant to help write the code. The idea, the data choices and the checking of the results are mine, and it's stated in the project's README.
