/* My Silk Invite — template personaliser.
   Takes a demo template's HTML and returns it with the visitor's own
   details in place of the demo couple's. Client-side only, no server.
   Exposes window.MSI.personalize(html, slug, user) and window.MSI.DEMO.
   user = { n1, n2, dateISO, time, venue, host, event, photo }.
   Replacements (in order): parents line removed (builder collects no
   parent names); demo dates -> user dates (same relative offsets, so
   Mehndi/Sangeet/Haldi and the RSVP-by date all shift with the wedding
   date, and the countdown literal targets the user date); demo venue ->
   user venue; demo host line -> user host; demo names -> user names
   (whole-word only, so "Ali" never corrupts "Malik"); demo monogram ->
   user monogram; the hero image -> the user photo when one is given.
   A <base href="templates/"> is injected so relative asset paths keep
   working when the personalised page is rendered outside templates/. */
(function (root) {
  "use strict";

  var DEMO = {"birds":{"n1":"Simran","n2":"Varun","dateISO":"2027-02-20","venue":["The Palm Grove, Goa"],"host":["With the blessings of our families","Together with their families"],"initials":["S ♥ V"],"dates":[{"text":"Saturday, 20 February 2027","iso":"2027-02-20"},{"text":"2027-02-20T19:00:00+05:00","iso":"2027-02-20"},{"text":"Sat 20 Feb","iso":"2027-02-20"},{"text":"Sun 21 Feb","iso":"2027-02-21"},{"text":"20 . 02 . 2027","iso":"2027-02-20"},{"text":"DTSTART:20270220T140000Z","iso":"2027-02-20"},{"text":"DTEND:20270220T180000Z","iso":"2027-02-20"}]},"blush-garden":{"n1":"Ananya","n2":"Aarav","dateISO":"2027-03-14","venue":["The Palm Courtyard, Udaipur","The Palm Courtyard","Lake Pichola Road, Udaipur"],"host":["Together with their families","Son of Mr & Mrs Rajesh Mehta","Daughter of Mr & Mrs Vikram Sharma"],"initials":["A & A","A ♥ A"],"dates":[{"text":"Sunday, 14 March 2027","iso":"2027-03-14"},{"text":"2027-03-14T19:00:00+05:00","iso":"2027-03-14"},{"text":"DTSTART:20270314T140000Z","iso":"2027-03-14"},{"text":"DTEND:20270314T180000Z","iso":"2027-03-14"},{"text":"14 . 03 . 2027","iso":"2027-03-14"},{"text":"Fri 12 Mar","iso":"2027-03-12"},{"text":"Sat 13 Mar","iso":"2027-03-13"},{"text":"Sun 14 Mar","iso":"2027-03-14"},{"text":"Sunday, 28 February 2027","iso":"2027-02-28"}]},"blush-ivory-lace":{"n1":"Riya","n2":"Aryan","dateISO":"2027-05-16","venue":["The Ivory House, Delhi","The Ivory House"],"host":["Together with their families","Son of Mr & Mrs Vikram Malhotra · Daughter of Mr & Mrs Sanjay Kapoor"],"initials":["R & A"],"dates":[{"text":"Sunday, 16 May 2027","iso":"2027-05-16"},{"text":"Sunday, 16 May 2027 · The Ivory House, Delhi","iso":"2027-05-16"},{"text":"16 . 05 . 2027","iso":"2027-05-16"},{"text":"2027-05-16T19:00:00+05:00","iso":"2027-05-16"},{"text":"DTSTART:20270516T140000Z","iso":"2027-05-16"},{"text":"DTEND:20270516T180000Z","iso":"2027-05-16"},{"text":"Riya & Aryan · Sunday, 16 May 2027 · The Ivory House, Delhi","iso":"2027-05-16"},{"text":"Friday, 14 May · 4:00 PM","iso":"2027-05-14"},{"text":"Saturday, 15 May · 7:00 PM","iso":"2027-05-15"},{"text":"Sunday, 16 May · 9:00 AM","iso":"2027-05-16"},{"text":"Kindly respond by 29 April 2027.","iso":"2027-04-29"}]},"blush-satin-gatefold":{"n1":"Kavya","n2":"Reyansh","dateISO":"2027-04-11","venue":["The Satin Court, Jaipur","The Satin Court","The Satin Court, C-Scheme, Jaipur"],"host":["Together with their families","Son of Mr & Mrs Rohan Malhotra","Daughter of Mr & Mrs Anil Kapoor"],"initials":["K & R"],"dates":[{"text":"Sunday, 11 April 2027","iso":"2027-04-11"},{"text":"2027-04-11T19:00:00+05:00","iso":"2027-04-11"},{"text":"DTSTART:20270411T140000Z","iso":"2027-04-11"},{"text":"DTEND:20270411T180000Z","iso":"2027-04-11"},{"text":"11 . 04 . 2027","iso":"2027-04-11"},{"text":"11 April 2027","iso":"2027-04-11"},{"text":"Sun 11 Apr","iso":"2027-04-11"},{"text":"Friday, 9 April 2027","iso":"2027-04-09"},{"text":"Saturday, 10 April 2027","iso":"2027-04-10"}]},"blush-swan-lake":{"n1":"Diya","n2":"Vivaan","dateISO":"2027-03-21","venue":["Lakeview Marquee, Jaipur","Lakeview Marquee","Tonk Road, Jaipur"],"host":["Together with their families","Son of Mr & Mrs Arjun Shah","Daughter of Mr & Mrs Rohan Patel"],"initials":["D & V","D ♥ V"],"dates":[{"text":"Sunday, 21 March 2027","iso":"2027-03-21"},{"text":"2027-03-21T19:00:00+05:00","iso":"2027-03-21"},{"text":"DTSTART:20270321T140000Z","iso":"2027-03-21"},{"text":"DTEND:20270321T180000Z","iso":"2027-03-21"},{"text":"21 . 03 . 2027","iso":"2027-03-21"},{"text":"Fri 19 Mar","iso":"2027-03-19"},{"text":"Sat 20 Mar","iso":"2027-03-20"},{"text":"Sun 21 Mar","iso":"2027-03-21"},{"text":"Sunday, 7 March 2027","iso":"2027-03-07"}]},"crimson-gold-regal":{"n1":"Aditi","n2":"Veer","dateISO":"2027-09-05","venue":["Crimson Hall, Kolkata","Crimson Hall"],"host":["Together with their families"],"initials":["A&V"],"dates":[{"text":"Sunday, 5 September 2027","iso":"2027-09-05"},{"text":"2027-09-05T19:00:00+05:00","iso":"2027-09-05"},{"text":"Sat 4 Sep","iso":"2027-09-04"},{"text":"Sun 5 Sep","iso":"2027-09-05"},{"text":"Mon 6 Sep","iso":"2027-09-06"},{"text":"05 . 09 . 2027","iso":"2027-09-05"},{"text":"20270905T140000Z","iso":"2027-09-05"},{"text":"20270905T180000Z","iso":"2027-09-05"}]},"emerald-jade-garden":{"n1":"Riddhi","n2":"Sameer","dateISO":"2027-07-25","venue":["Jade Garden, Bangalore"],"host":["With the blessings of our families","Together with their families"],"initials":[],"dates":[{"text":"Sunday, 25 July 2027","iso":"2027-07-25"},{"text":"2027-07-25T19:00:00+05:00","iso":"2027-07-25"},{"text":"Sun 25 Jul","iso":"2027-07-25"},{"text":"Mon 26 Jul","iso":"2027-07-26"},{"text":"25 . 07 . 2027","iso":"2027-07-25"},{"text":"20270725T140000Z","iso":"2027-07-25"},{"text":"20270725T180000Z","iso":"2027-07-25"}]},"emerald-palace":{"n1":"Shreya","n2":"Nikhil","dateISO":"2027-06-20","venue":["Emerald Court, Jaipur"],"host":["With the blessings of our families","Together with their families"],"initials":[],"dates":[{"text":"Sunday, 20 June 2027","iso":"2027-06-20"},{"text":"2027-06-20T19:00:00+05:00","iso":"2027-06-20"},{"text":"Sun 20 Jun","iso":"2027-06-20"},{"text":"Mon 21 Jun","iso":"2027-06-21"},{"text":"20 . 06 . 2027","iso":"2027-06-20"},{"text":"DTSTART:20270620T140000Z","iso":"2027-06-20"},{"text":"DTEND:20270620T180000Z","iso":"2027-06-20"}]},"golden-hour":{"n1":"Divya","n2":"Rahul","dateISO":"2027-07-04","venue":["Golden Hour Gardens, Udaipur"],"host":["With the blessings of our families","Together with their families"],"initials":[],"dates":[{"text":"Sunday, 4 July 2027","iso":"2027-07-04"},{"text":"2027-07-04T19:00:00+05:00","iso":"2027-07-04"},{"text":"Sun 4 Jul","iso":"2027-07-04"},{"text":"Mon 5 Jul","iso":"2027-07-05"},{"text":"04 . 07 . 2027","iso":"2027-07-04"},{"text":"20270704T140000Z","iso":"2027-07-04"},{"text":"20270704T180000Z","iso":"2027-07-04"}]},"golden-light-rain":{"n1":"Ishita","n2":"Dev","dateISO":"2027-05-02","venue":["Blush Garden Hall, Goa","Blush Garden Hall"],"host":["Together with their families","Son of Mr & Mrs Rajesh Mehta · Daughter of Mr & Mrs Anil Sharma"],"initials":["I & D"],"dates":[{"text":"Sunday, 2 May 2027","iso":"2027-05-02"},{"text":"Sunday, 2 May 2027 · Blush Garden Hall, Goa","iso":"2027-05-02"},{"text":"02 . 05 . 2027","iso":"2027-05-02"},{"text":"2027-05-02T19:00:00+05:00","iso":"2027-05-02"},{"text":"DTSTART:20270502T140000Z","iso":"2027-05-02"},{"text":"DTEND:20270502T180000Z","iso":"2027-05-02"},{"text":"Ishita & Dev · Sunday, 2 May 2027 · Blush Garden Hall, Goa","iso":"2027-05-02"},{"text":"Friday, 30 April · 4:00 PM","iso":"2027-04-30"},{"text":"Saturday, 1 May · 7:00 PM","iso":"2027-05-01"},{"text":"Sunday, 2 May · 9:00 AM","iso":"2027-05-02"},{"text":"Kindly respond by 15 April 2027.","iso":"2027-04-15"}]},"golden-rose-dome":{"n1":"Maryam","n2":"Hassan","dateISO":"2027-04-18","venue":["Dome Palace, Islamabad","Dome Palace","Dome Palace, Blue Area, Islamabad"],"host":["Together with their families","Son of Mr & Mrs Faisal Raza","Daughter of Mr & Mrs Imran Khan"],"initials":["M & H"],"dates":[{"text":"Sunday, 18 April 2027","iso":"2027-04-18"},{"text":"2027-04-18T19:00:00+05:00","iso":"2027-04-18"},{"text":"DTSTART:20270418T140000Z","iso":"2027-04-18"},{"text":"DTEND:20270418T180000Z","iso":"2027-04-18"},{"text":"18 . 04 . 2027","iso":"2027-04-18"},{"text":"Sun 18 Apr","iso":"2027-04-18"},{"text":"Mon 19 Apr","iso":"2027-04-19"},{"text":"Monday, 19 April 2027","iso":"2027-04-19"},{"text":"Friday, 16 April 2027","iso":"2027-04-16"},{"text":"Saturday, 17 April 2027","iso":"2027-04-17"}]},"ivory-gold-classic":{"n1":"Nisha","n2":"Vikram","dateISO":"2027-07-11","venue":["The Classic Hall, Kolkata"],"host":["With the blessings of our families","Together with their families"],"initials":[],"dates":[{"text":"Sunday, 11 July 2027","iso":"2027-07-11"},{"text":"2027-07-11T19:00:00+05:00","iso":"2027-07-11"},{"text":"Sun 11 Jul","iso":"2027-07-11"},{"text":"Mon 12 Jul","iso":"2027-07-12"},{"text":"11 . 07 . 2027","iso":"2027-07-11"},{"text":"20270711T140000Z","iso":"2027-07-11"},{"text":"20270711T180000Z","iso":"2027-07-11"}]},"lavender-dusk":{"n1":"Tanya","n2":"Dhruv","dateISO":"2027-08-08","venue":["Lavender Hall, Hyderabad","Lavender Hall"],"host":["With the blessings of our families","Together with their families"],"initials":[],"dates":[{"text":"Sunday, 8 August 2027","iso":"2027-08-08"},{"text":"2027-08-08T19:00:00+05:00","iso":"2027-08-08"},{"text":"Sun 8 Aug","iso":"2027-08-08"},{"text":"Mon 9 Aug","iso":"2027-08-09"},{"text":"08 . 08 . 2027","iso":"2027-08-08"},{"text":"20270808T140000Z","iso":"2027-08-08"},{"text":"20270808T180000Z","iso":"2027-08-08"}]},"maroon-royal-nikah":{"n1":"Zainab","n2":"Daniyal","dateISO":"2027-09-19","venue":["The Maroon Palace, Lahore","The Maroon Palace"],"host":["Zainab, daughter of Mr & Mrs Bilal Ahmed","Daniyal, son of Mr & Mrs Usman Malik"],"initials":["Z & D"],"dates":[{"text":"Nikah · Sunday, 19 September 2027","iso":"2027-09-19"},{"text":"Sunday, 19 September 2027","iso":"2027-09-19"},{"text":"Sunday, 19 September 2027 · The Maroon Palace, Lahore","iso":"2027-09-19"},{"text":"2027-09-19T19:00:00+05:00","iso":"2027-09-19"},{"text":"DTSTART:20270919T140000Z","iso":"2027-09-19"},{"text":"DTEND:20270919T180000Z","iso":"2027-09-19"},{"text":"Zainab ♥ Daniyal · 19 . 09 . 2027 · Demo invitation — no video, only code","iso":"2027-09-19"},{"text":"Sun 19 Sep","iso":"2027-09-19"},{"text":"Mon 20 Sep","iso":"2027-09-20"},{"text":"Fri 17 Sep","iso":"2027-09-17"},{"text":"Sat 18 Sep","iso":"2027-09-18"},{"text":"Kindly respond by 5 September 2027 so we can keep a seat — and a plate — ready for you.","iso":"2027-09-05"}]},"midnight-sapphire":{"n1":"Aishwarya","n2":"Raj","dateISO":"2027-07-18","venue":["Sapphire Ballroom, Mumbai"],"host":["With the blessings of our families","Together with their families"],"initials":[],"dates":[{"text":"Sunday, 18 July 2027","iso":"2027-07-18"},{"text":"2027-07-18T19:00:00+05:00","iso":"2027-07-18"},{"text":"Sun 18 Jul","iso":"2027-07-18"},{"text":"Mon 19 Jul","iso":"2027-07-19"},{"text":"18 . 07 . 2027","iso":"2027-07-18"},{"text":"20270718T140000Z","iso":"2027-07-18"},{"text":"20270718T180000Z","iso":"2027-07-18"}]},"minimal-white":{"n1":"Preeti","n2":"Manav","dateISO":"2027-08-22","venue":["The White Gallery, Delhi","The White Gallery"],"host":["Together with their families"],"initials":[],"dates":[{"text":"Sunday, 22 August 2027","iso":"2027-08-22"},{"text":"2027-08-22T19:00:00+05:00","iso":"2027-08-22"},{"text":"Sun 22 Aug","iso":"2027-08-22"},{"text":"Mon 23 Aug","iso":"2027-08-23"},{"text":"22 . 08 . 2027","iso":"2027-08-22"},{"text":"20270822T140000Z","iso":"2027-08-22"},{"text":"20270822T180000Z","iso":"2027-08-22"}]},"moonlit-blush-balcony":{"n1":"Nadia","n2":"Faisal","dateISO":"2027-05-30","venue":["Moonlight Terrace, Islamabad","Moonlight Terrace"],"host":["Together with their families","Nadia, daughter of Mr & Mrs Tariq Ahmed","Faisal, son of Mr & Mrs Imran Khan"],"initials":["N & F"],"dates":[{"text":"Sunday, 30 May 2027","iso":"2027-05-30"},{"text":"Sunday, 30 May 2027 · Moonlight Terrace, Islamabad","iso":"2027-05-30"},{"text":"2027-05-30T19:00:00+05:00","iso":"2027-05-30"},{"text":"DTSTART:20270530T140000Z","iso":"2027-05-30"},{"text":"DTEND:20270530T180000Z","iso":"2027-05-30"},{"text":"Nadia ♥ Faisal · 30 . 05 . 2027","iso":"2027-05-30"},{"text":"Sun 30 May","iso":"2027-05-30"},{"text":"Mon 31 May","iso":"2027-05-31"},{"text":"Fri 28 May","iso":"2027-05-28"},{"text":"Sat 29 May","iso":"2027-05-29"},{"text":"Kindly respond by 15 May 2027 so we can keep a seat — and a plate — ready for you.","iso":"2027-05-15"}]},"ocean-pearl":{"n1":"Kiran","n2":"Rohan","dateISO":"2027-09-12","venue":["Ocean Pearl Resort, Goa","Ocean Pearl Resort"],"host":["Together with their families"],"initials":[],"dates":[{"text":"Sunday, 12 September 2027","iso":"2027-09-12"},{"text":"2027-09-12T19:00:00+05:00","iso":"2027-09-12"},{"text":"Sat 11 Sep","iso":"2027-09-11"},{"text":"Sun 12 Sep","iso":"2027-09-12"},{"text":"Mon 13 Sep","iso":"2027-09-13"},{"text":"12 . 09 . 2027","iso":"2027-09-12"},{"text":"20270912T140000Z","iso":"2027-09-12"},{"text":"20270912T180000Z","iso":"2027-09-12"}]},"peacock-royal":{"n1":"Komal","n2":"Ankit","dateISO":"2027-08-15","venue":["Peacock Palace, Jaipur","Peacock Palace"],"host":["Together with their families"],"initials":[],"dates":[{"text":"Sunday, 15 August 2027","iso":"2027-08-15"},{"text":"2027-08-15T19:00:00+05:00","iso":"2027-08-15"},{"text":"Sat 14 Aug","iso":"2027-08-14"},{"text":"Sun 15 Aug","iso":"2027-08-15"},{"text":"Mon 16 Aug","iso":"2027-08-16"},{"text":"15 . 08 . 2027","iso":"2027-08-15"},{"text":"20270815T140000Z","iso":"2027-08-15"},{"text":"20270815T180000Z","iso":"2027-08-15"}]},"pearl-petal-arch":{"n1":"Meera","n2":"Aditya","dateISO":"2027-03-28","venue":["The Pearl Hall, Mumbai","The Pearl Hall","Linking Road, Bandra West, Mumbai"],"host":["Together with their families","Son of Mr & Mrs Sanjay Verma","Daughter of Mr & Mrs Amit Kapoor"],"initials":["M & A","M ♥ A"],"dates":[{"text":"Sunday, 28 March 2027","iso":"2027-03-28"},{"text":"2027-03-28T19:00:00+05:00","iso":"2027-03-28"},{"text":"DTSTART:20270328T140000Z","iso":"2027-03-28"},{"text":"DTEND:20270328T180000Z","iso":"2027-03-28"},{"text":"28 . 03 . 2027","iso":"2027-03-28"},{"text":"Fri 26 Mar","iso":"2027-03-26"},{"text":"Sat 27 Mar","iso":"2027-03-27"},{"text":"Sun 28 Mar","iso":"2027-03-28"},{"text":"Sunday, 14 March 2027","iso":"2027-03-14"}]},"rose-gold-chandelier":{"n1":"Priya","n2":"Arjun","dateISO":"2027-04-04","venue":["Crystal Ballroom, Delhi","Crystal Ballroom","Crystal Ballroom, Connaught Place, New Delhi"],"host":["Together with their families","Son of Mr & Mrs Vikram Mehta","Daughter of Mr & Mrs Rajesh Sharma"],"initials":["P & A"],"dates":[{"text":"Sunday, 4 April 2027","iso":"2027-04-04"},{"text":"2027-04-04T19:00:00+05:00","iso":"2027-04-04"},{"text":"DTSTART:20270404T140000Z","iso":"2027-04-04"},{"text":"DTEND:20270404T180000Z","iso":"2027-04-04"},{"text":"04 . 04 . 2027","iso":"2027-04-04"},{"text":"4 April 2027","iso":"2027-04-04"},{"text":"Sun 4 Apr","iso":"2027-04-04"},{"text":"Friday, 2 April 2027","iso":"2027-04-02"},{"text":"Saturday, 3 April 2027","iso":"2027-04-03"}]},"rose-gold-gates":{"n1":"Ayesha","n2":"Bilal","dateISO":"2027-02-27","venue":["The Rosewood Palace, Lahore","The Rosewood Palace","MM Alam Road, Gulberg III, Lahore"],"host":["Together with their families","Son of Mr & Mrs Imran Ahmed","Daughter of Mr & Mrs Tariq Khan"],"initials":["A & B","A ♥ B"],"dates":[{"text":"Saturday, 27 February 2027","iso":"2027-02-27"},{"text":"2027-02-27T19:00:00+05:00","iso":"2027-02-27"},{"text":"DTSTART:20270227T140000Z","iso":"2027-02-27"},{"text":"DTEND:20270227T180000Z","iso":"2027-02-27"},{"text":"Thu 25 Feb","iso":"2027-02-25"},{"text":"Fri 26 Feb","iso":"2027-02-26"},{"text":"Sat 27 Feb","iso":"2027-02-27"},{"text":"Sun 28 Feb","iso":"2027-02-28"},{"text":"Saturday, 13 February 2027","iso":"2027-02-13"}]},"rose-gold-ribbon":{"n1":"Pooja","n2":"Nakul","dateISO":"2027-06-06","venue":["The Ribbon Hall, Pune","The Ribbon Hall"],"host":["Together with their families","Blessed by our families, united in love","Pooja, daughter of Mr & Mrs Rajesh Sharma","Nakul, son of Mr & Mrs Vikram Mehta"],"initials":["P & N","P ♥ N"],"dates":[{"text":"Sunday, 6 June 2027","iso":"2027-06-06"},{"text":"Sunday, 6 June 2027 · The Ribbon Hall, Pune","iso":"2027-06-06"},{"text":"2027-06-06T19:00:00+05:00","iso":"2027-06-06"},{"text":"DTSTART:20270606T140000Z","iso":"2027-06-06"},{"text":"DTEND:20270606T180000Z","iso":"2027-06-06"},{"text":"Pooja ♥ Nakul · 06 . 06 . 2027","iso":"2027-06-06"},{"text":"Sun 6 Jun","iso":"2027-06-06"},{"text":"Fri 4 Jun","iso":"2027-06-04"},{"text":"Sat 5 Jun","iso":"2027-06-05"},{"text":"Kindly respond by 23 May 2027 so we can keep a seat — and a plate — ready for you.","iso":"2027-05-23"}]},"rose-gold-vine":{"n1":"Naina","n2":"Yash","dateISO":"2027-05-09","venue":["Vineyard Hall, Nashik","Vineyard Hall"],"host":["Together with their families","Son of Mr & Mrs Sunil Patil · Daughter of Mr & Mrs Prakash Deshmukh"],"initials":["N & Y"],"dates":[{"text":"Sunday, 9 May 2027","iso":"2027-05-09"},{"text":"Sunday, 9 May 2027 · Vineyard Hall, Nashik","iso":"2027-05-09"},{"text":"09 . 05 . 2027","iso":"2027-05-09"},{"text":"2027-05-09T19:00:00+05:00","iso":"2027-05-09"},{"text":"DTSTART:20270509T140000Z","iso":"2027-05-09"},{"text":"DTEND:20270509T180000Z","iso":"2027-05-09"},{"text":"Naina & Yash · Sunday, 9 May 2027 · Vineyard Hall, Nashik","iso":"2027-05-09"},{"text":"Friday, 7 May · 4:00 PM","iso":"2027-05-07"},{"text":"Saturday, 8 May · 7:00 PM","iso":"2027-05-08"},{"text":"Sunday, 9 May · 9:00 AM","iso":"2027-05-09"},{"text":"Kindly respond by 22 April 2027.","iso":"2027-04-22"}]},"royal":{"n1":"Neha","n2":"Sahil","dateISO":"2027-03-12","venue":["Shalimar Gardens, Delhi"],"host":["With the blessings of our families","Together with their families"],"initials":["N ♥ S"],"dates":[{"text":"Friday, 12 March 2027","iso":"2027-03-12"},{"text":"2027-03-12T19:00:00+05:00","iso":"2027-03-12"},{"text":"Fri 12 Mar","iso":"2027-03-12"},{"text":"Sat 13 Mar","iso":"2027-03-13"},{"text":"12 . 03 . 2027","iso":"2027-03-12"},{"text":"DTSTART:20270312T140000Z","iso":"2027-03-12"},{"text":"DTEND:20270312T180000Z","iso":"2027-03-12"}]},"royal-blush-drapes":{"n1":"Sneha","n2":"Karan","dateISO":"2027-06-13","venue":["Grand Theatre Hall, Mumbai","Grand Theatre Hall"],"host":["Together with their families","With the blessings of our families and the joy of our friends","Sneha, daughter of Mr & Mrs Anil Deshpande","Karan, son of Mr & Mrs Rohit Kapoor"],"initials":["S & K"],"dates":[{"text":"Sunday, 13 June 2027","iso":"2027-06-13"},{"text":"Sunday, 13 June 2027 · Grand Theatre Hall, Mumbai","iso":"2027-06-13"},{"text":"2027-06-13T19:00:00+05:00","iso":"2027-06-13"},{"text":"DTSTART:20270613T140000Z","iso":"2027-06-13"},{"text":"DTEND:20270613T180000Z","iso":"2027-06-13"},{"text":"Sneha ♥ Karan · 13 . 06 . 2027","iso":"2027-06-13"},{"text":"Sun 13 Jun","iso":"2027-06-13"},{"text":"Fri 11 Jun","iso":"2027-06-11"},{"text":"Sat 12 Jun","iso":"2027-06-12"},{"text":"Kindly respond by 30 May 2027 so we can keep a seat — and a plate — ready for you.","iso":"2027-05-30"}]},"royal-blush-palace":{"n1":"Fatima","n2":"Ali","dateISO":"2027-04-25","venue":["Royal Palm Marquee, Karachi","Royal Palm Marquee","Royal Palm Marquee, Shahrah-e-Faisal, Karachi"],"host":["Together with their families","Son of Mr & Mrs Kamran Sheikh","Daughter of Mr & Mrs Naveed Hussain"],"initials":["F & A"],"dates":[{"text":"Sunday, 25 April 2027","iso":"2027-04-25"},{"text":"2027-04-25T19:00:00+05:00","iso":"2027-04-25"},{"text":"DTSTART:20270425T140000Z","iso":"2027-04-25"},{"text":"DTEND:20270425T180000Z","iso":"2027-04-25"},{"text":"25 . 04 . 2027","iso":"2027-04-25"},{"text":"25 April 2027","iso":"2027-04-25"},{"text":"Sun 25 Apr","iso":"2027-04-25"},{"text":"Mon 26 Apr","iso":"2027-04-26"},{"text":"Monday, 26 April 2027","iso":"2027-04-26"},{"text":"Friday, 23 April 2027","iso":"2027-04-23"},{"text":"Saturday, 24 April 2027","iso":"2027-04-24"}]},"royal-rose-crest":{"n1":"Tanvi","n2":"Vihaan","dateISO":"2027-05-23","venue":["Crestwood Palace, Jaipur","Crestwood Palace"],"host":["Together with their families","Son of Mr & Mrs Arjun Shekhawat · Daughter of Mr & Mrs Devendra Rathore"],"initials":["T & V"],"dates":[{"text":"Sunday, 23 May 2027","iso":"2027-05-23"},{"text":"Sunday, 23 May 2027 · Crestwood Palace, Jaipur","iso":"2027-05-23"},{"text":"23 . 05 . 2027","iso":"2027-05-23"},{"text":"2027-05-23T19:00:00+05:00","iso":"2027-05-23"},{"text":"DTSTART:20270523T140000Z","iso":"2027-05-23"},{"text":"DTEND:20270523T180000Z","iso":"2027-05-23"},{"text":"Tanvi & Vihaan · Sunday, 23 May 2027 · Crestwood Palace, Jaipur","iso":"2027-05-23"},{"text":"Friday, 21 May · 4:00 PM","iso":"2027-05-21"},{"text":"Saturday, 22 May · 7:00 PM","iso":"2027-05-22"},{"text":"Sunday, 23 May · 9:00 AM","iso":"2027-05-23"},{"text":"Kindly respond by 6 May 2027.","iso":"2027-05-06"}]},"rustic-olive-grove":{"n1":"Ritu","n2":"Arnav","dateISO":"2027-08-29","venue":["Olive Grove Farm, Chandigarh","Olive Grove Farm"],"host":["Together with their families"],"initials":[],"dates":[{"text":"Sunday, 29 August 2027","iso":"2027-08-29"},{"text":"2027-08-29T19:00:00+05:00","iso":"2027-08-29"},{"text":"Sat 28 Aug","iso":"2027-08-28"},{"text":"Sun 29 Aug","iso":"2027-08-29"},{"text":"Mon 30 Aug","iso":"2027-08-30"},{"text":"29 . 08 . 2027","iso":"2027-08-29"},{"text":"20270829T140000Z","iso":"2027-08-29"},{"text":"20270829T180000Z","iso":"2027-08-29"}]},"sunset-mehndi":{"n1":"Anika","n2":"Aman","dateISO":"2027-06-27","venue":["Sunset Lawn, Goa"],"host":["With the blessings of our families","Together with their families"],"initials":[],"dates":[{"text":"Sunday, 27 June 2027","iso":"2027-06-27"},{"text":"2027-06-27T19:00:00+05:00","iso":"2027-06-27"},{"text":"Sat 26 Jun","iso":"2027-06-26"},{"text":"Sun 27 Jun","iso":"2027-06-27"},{"text":"27 . 06 . 2027","iso":"2027-06-27"},{"text":"DTSTART:20270627T140000Z","iso":"2027-06-27"},{"text":"DTEND:20270627T180000Z","iso":"2027-06-27"}]},"sunset-terracotta":{"n1":"Sanjana","n2":"Ishaan","dateISO":"2027-08-01","venue":["Terracotta Courtyard, Chennai","Terracotta Courtyard"],"host":["With the blessings of our families","Together with their families"],"initials":[],"dates":[{"text":"Sunday, 1 August 2027","iso":"2027-08-01"},{"text":"2027-08-01T19:00:00+05:00","iso":"2027-08-01"},{"text":"Sun 1 Aug","iso":"2027-08-01"},{"text":"Mon 2 Aug","iso":"2027-08-02"},{"text":"01 . 08 . 2027","iso":"2027-08-01"},{"text":"20270801T140000Z","iso":"2027-08-01"},{"text":"20270801T180000Z","iso":"2027-08-01"}]}};

  var WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MO_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MO_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  /* The DEMO map records text as read; the files spell some characters
     as HTML entities (· is &middot;, & is &amp;, ♥ is &hearts;). */
  function htmlForm(s) {
    return String(s).replace(/&/g, "&amp;").replace(/\u00b7/g, "&middot;").replace(/\u2665/g, "&hearts;");
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function parseISO(iso) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return null;
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }
  function toISODate(d) {
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function addDaysISO(iso, n) {
    var d = parseISO(iso);
    if (!d) return iso;
    d.setUTCDate(d.getUTCDate() + n);
    return toISODate(d);
  }
  function dayDiffISO(a, b) {
    var da = parseISO(a), db = parseISO(b);
    if (!da || !db) return 0;
    return Math.round((da.getTime() - db.getTime()) / 86400000);
  }
  function replaceAll(str, find, rep) {
    if (!find) return str;
    return str.split(find).join(rep);
  }
  function replaceWord(str, word, rep) {
    if (!word) return str;
    var re = new RegExp("\\b" + escRe(word) + "\\b", "g");
    return str.replace(re, function () { return rep; });
  }

  /* Find the date substring inside a recorded date string. Most recorded
     strings ARE just a date; a few are whole sentences ("Kindly respond
     by 5 September 2027 ...") where only the date part is replaced. */
  var DATE_PATTERNS = [
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:00/,
    /\d{8}T\d{6}Z/,
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/,
    /\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/,
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December)/,
    /(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/,
    /\d{2} \. \d{2} \. \d{4}/,
    /\d{4}-\d{2}-\d{2}/
  ];
  function findDateCore(text) {
    for (var i = 0; i < DATE_PATTERNS.length; i++) {
      var m = String(text).match(DATE_PATTERNS[i]);
      if (m) return m[0];
    }
    return String(text);
  }
  function dateFormat(core) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:00$/.test(core)) return "iso-dt";
    if (/^\d{8}T\d{6}Z$/.test(core)) return "ics";
    if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/.test(core)) return "weekday-long";
    if (/^\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/.test(core)) return "long";
    if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December)$/.test(core)) return "weekday-no-year";
    if (/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(core)) return "short-wd";
    if (/^\d{2} \. \d{2} \. \d{4}$/.test(core)) return "dotted";
    if (/^\d{4}-\d{2}-\d{2}$/.test(core)) return "iso";
    return "long";
  }
  /* Format the user's date the same way the demo date was written.
     icsOffsetHours shifts the .ics time from the demo start (14:00Z, the
     19:00+05:00 start) — DTSTART gets 0, DTEND gets +4. */
  function fmtUserDate(userISO, format, userTime, icsOffsetHours) {
    var d = parseISO(userISO);
    if (!d) return "";
    var dow = d.getUTCDay(), day = d.getUTCDate(), mo = d.getUTCMonth(), yr = d.getUTCFullYear();
    if (format === "weekday-long") return WD_LONG[dow] + ", " + day + " " + MO_LONG[mo] + " " + yr;
    if (format === "long") return day + " " + MO_LONG[mo] + " " + yr;
    if (format === "weekday-no-year") return WD_LONG[dow] + ", " + day + " " + MO_LONG[mo];
    if (format === "short-wd") return WD_SHORT[dow] + " " + day + " " + MO_SHORT[mo];
    if (format === "dotted") return pad(day) + " . " + pad(mo + 1) + " . " + yr;
    if (format === "iso") return toISODate(d);
    if (format === "iso-dt") return toISODate(d) + "T" + (userTime || "19:00") + ":00+05:00";
    if (format === "ics") {
      var parts = String(userTime || "19:00").split(":");
      var mins = (+parts[0]) * 60 + (+parts[1] || 0) - 300 + (icsOffsetHours || 0) * 60;
      var dt = new Date(Date.UTC(yr, mo, day, 0, 0, 0) + mins * 60000);
      return dt.getUTCFullYear() + pad(dt.getUTCMonth() + 1) + pad(dt.getUTCDate()) +
        "T" + pad(dt.getUTCHours()) + pad(dt.getUTCMinutes()) + "00Z";
    }
    return day + " " + MO_LONG[mo] + " " + yr;
  }
  function userInitialsFor(demoInit, u) {
    var a = (u.n1 || "").charAt(0).toUpperCase() || "A";
    var b = (u.n2 || "").charAt(0).toUpperCase() || "";
    if (!u.n2 || !b) return a;
    if (demoInit.indexOf("\u2665") >= 0) return a + " \u2665 " + b;
    if (demoInit.indexOf(" & ") >= 0) return a + " & " + b;
    if (demoInit.indexOf("&") >= 0) return a + "&" + b;
    return a + " & " + b;
  }

  function personalize(htmlText, slug, user) {
    var demo = DEMO[slug];
    if (!demo || typeof htmlText !== "string") return htmlText;
    var out = htmlText;
    var u = {
      n1: (user.n1 || "").trim(),
      n2: (user.n2 || "").trim(),
      dateISO: user.dateISO || "",
      time: user.time || "19:00",
      venue: (user.venue || "").trim(),
      host: (user.host || "").trim() || "Together with their families",
      event: user.event || "Wedding",
      photo: user.photo || ""
    };

    /* 1. Parents line: the builder collects no parent names, so the demo
       parents line is removed rather than shown wrong. */
    out = out.replace(/<(div|p)\s+class="parents"[^>]*>[\s\S]*?<\/\1>/g, "");

    /* 2. Dates: ONE pass (map + alternation, longest core first) so
       "19 September 2027" never corrupts "Sunday, 19 September 2027"
       and a replacement is never re-scanned. Each date shifts by its
       offset from the demo main date (Mehndi -1/-2 days, reception +1,
       RSVP -14). */
    if (u.dateISO && demo.dates) {
      var dateMap = {};
      demo.dates.forEach(function (e) {
        var core = findDateCore(e.text);
        var format = dateFormat(core);
        var targetISO = addDaysISO(u.dateISO, dayDiffISO(e.iso, demo.dateISO));
        var icsOff = 0;
        if (format === "ics") {
          var m = core.match(/T(\d{2})(\d{2})(\d{2})Z/);
          if (m) icsOff = Math.round(((+m[1]) * 60 + (+m[2]) - 840) / 60);
        }
        var rep = fmtUserDate(targetISO, format, u.time, icsOff);
        if (rep) {
          dateMap[core] = rep;
          var hc = htmlForm(core);
          if (hc !== core) dateMap[hc] = rep;
        }
      });
      var dateKeys = Object.keys(dateMap).sort(function (a, b) { return b.length - a.length; });
      if (dateKeys.length) {
        var dateRe = new RegExp(dateKeys.map(escRe).join("|"), "g");
        out = out.replace(dateRe, function (m) { return dateMap[m]; });
      }
    }

    /* 3. Venue: ONE pass; also the .ics-escaped forms (comma -> \, in
       both the 2-backslash and 4-backslash spellings the templates use)
       and the URL-encoded form (the Google Maps link query). */
    if (u.venue && demo.venue) {
      var vMap = {};
      demo.venue.forEach(function (v) {
        vMap[v] = esc(u.venue);
        vMap[v.replace(/,/g, "\\\\,")] = esc(u.venue).replace(/,/g, "\\\\,");
        vMap[v.replace(/,/g, "\\\\\\\\,")] = esc(u.venue).replace(/,/g, "\\\\\\\\,");
        try { vMap[encodeURIComponent(v)] = encodeURIComponent(u.venue); } catch (e) { /* ignore */ }
      });
      var vKeys = Object.keys(vMap).sort(function (a, b) { return b.length - a.length; });
      if (vKeys.length) {
        var vRe = new RegExp(vKeys.map(escRe).join("|"), "g");
        out = out.replace(vRe, function (m) { return vMap[m]; });
      }
    }

    /* 4. Host line (the eyebrow). "With the blessings..." is a generic
       blessing, not a host line, so it is left alone. */
    var hostMap = {};
    if (demo.host) {
      demo.host.forEach(function (h) {
        if (h.indexOf("blessings") >= 0) return;
        hostMap[h] = esc(u.host);
        hostMap[h.replace(/&/g, "&amp;")] = esc(u.host);
      });
    }
    hostMap["Together with their families"] = esc(u.host);
    var hostKeys = Object.keys(hostMap).sort(function (a, b) { return b.length - a.length; });
    if (hostKeys.length) {
      var hostRe = new RegExp(hostKeys.map(escRe).join("|"), "g");
      out = out.replace(hostRe, function (m) { return hostMap[m]; });
    }

    /* 5. Names: ONE pass, whole-word only. A single pass means a user
       name that equals a demo name (e.g. user "Meera" on the Meera &
       Aditya template) cannot be overwritten by the second replacement. */
    var nameMap = {};
    if (demo.n1) nameMap[demo.n1] = esc(u.n1) || demo.n1;
    if (demo.n2) nameMap[demo.n2] = esc(u.n2) || demo.n2;
    var nameKeys = Object.keys(nameMap).sort(function (a, b) { return b.length - a.length; });
    if (nameKeys.length) {
      var nameRe = new RegExp("\\b(" + nameKeys.map(escRe).join("|") + ")\\b", "g");
      out = out.replace(nameRe, function (m) { return nameMap[m]; });
    }

    /* 6. Monogram: same separator as the demo's (heart, " & " or "&"). */
    if (demo.initials) {
      var initMap = {};
      demo.initials.forEach(function (init) {
        var ui = userInitialsFor(init, u);
        var htmlInit = init.replace(/&/g, "&amp;").replace(/\u2665/g, "&hearts;");
        var htmlUI = ui.replace(/&/g, "&amp;").replace(/\u2665/g, "&hearts;");
        initMap[htmlInit] = htmlUI;
        initMap[init] = ui;
      });
      var initKeys = Object.keys(initMap).sort(function (a, b) { return b.length - a.length; });
      if (initKeys.length) {
        var initRe = new RegExp(initKeys.map(escRe).join("|"), "g");
        out = out.replace(initRe, function (m) { return initMap[m]; });
      }
    }

    /* 7. Photo: the first local image (the hero) becomes the user photo. */
    if (u.photo) {
      out = out.replace(/<img([^>]*?)src="(?!(?:https?:|data:))[^"]*"([^>]*?)>/, function (m, pre, post) {
        return "<img" + pre + 'src="' + u.photo + '"' + post + ">";
      });
    }

    /* 8. Base so relative assets resolve outside templates/. */
    if (!/<base[\s>]/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, function (m, attrs) {
        return '<head' + attrs + '>\n<base href="templates/">';
      });
    }
    return out;
  }

  root.MSI = root.MSI || {};
  root.MSI.DEMO = DEMO;
  root.MSI.personalize = personalize;
})(typeof window !== "undefined" ? window : this);
