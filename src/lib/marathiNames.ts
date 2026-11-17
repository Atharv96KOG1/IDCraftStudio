/**
 * Common Maharashtrian / Indian first names, surnames, places and ID-card
 * words, English spelling → Marathi. Used before the spelling rules, so
 * frequent names come out right. Users' own corrections are added on top.
 */
export const NAME_DICT: Record<string, string> = {
  // ---- first names (boys) ----
  aarav: 'आरव', aditya: 'आदित्य', ajay: 'अजय', akash: 'आकाश', amit: 'अमित', amol: 'अमोल', anand: 'आनंद', aniket: 'अनिकेत',
  anil: 'अनिल', ankit: 'अंकित', ankush: 'अंकुश', arjun: 'अर्जुन', ashish: 'आशिष', ashok: 'अशोक', atharv: 'अथर्व', atharva: 'अथर्व',
  avinash: 'अविनाश', ayush: 'आयुष', balaji: 'बालाजी', bhushan: 'भूषण', chetan: 'चेतन', chinmay: 'चिन्मय', datta: 'दत्ता',
  deepak: 'दीपक', dilip: 'दिलीप', dinesh: 'दिनेश', ganesh: 'गणेश', gaurav: 'गौरव', harsh: 'हर्ष', harshad: 'हर्षद',
  hemant: 'हेमंत', jayesh: 'जयेश', kailas: 'कैलास', kiran: 'किरण', krishna: 'कृष्ण', kunal: 'कुणाल', mahesh: 'महेश',
  mangesh: 'मंगेश', manoj: 'मनोज', mayur: 'मयूर', milind: 'मिलिंद', mohan: 'मोहन', nagesh: 'नागेश', narayan: 'नारायण',
  nikhil: 'निखिल', nilesh: 'निलेश', nitin: 'नितीन', omkar: 'ओंकार', onkar: 'ओंकार', pankaj: 'पंकज', parth: 'पार्थ',
  pradeep: 'प्रदीप', prakash: 'प्रकाश', pramod: 'प्रमोद', pranav: 'प्रणव', prasad: 'प्रसाद', prashant: 'प्रशांत',
  prathamesh: 'प्रथमेश', pravin: 'प्रवीण', praveen: 'प्रवीण', rahul: 'राहुल', raj: 'राज', rajesh: 'राजेश', rajendra: 'राजेंद्र',
  ramesh: 'रमेश', ravi: 'रवी', robert: 'रॉबर्ट', rohan: 'रोहन', rohit: 'रोहित', sachin: 'सचिन', sagar: 'सागर', sahil: 'साहिल',
  sameer: 'समीर', samir: 'समीर', sandeep: 'संदीप', sanjay: 'संजय', santosh: 'संतोष', sanmati: 'सन्मती', sarthak: 'सार्थक',
  satish: 'सतीश', shankar: 'शंकर', shivam: 'शिवम', shivansh: 'शिवांश', shivaji: 'शिवाजी', shreyas: 'श्रेयस', shubham: 'शुभम',
  siddharth: 'सिद्धार्थ', sourabh: 'सौरभ', saurabh: 'सौरभ', subhash: 'सुभाष', sudhir: 'सुधीर', suhas: 'सुहास', sunil: 'सुनील',
  suraj: 'सूरज', suresh: 'सुरेश', sushant: 'सुशांत', swapnil: 'स्वप्नील', tanmay: 'तन्मय', tejas: 'तेजस', tushar: 'तुषार',
  uday: 'उदय', umesh: 'उमेश', vaibhav: 'वैभव', vedant: 'वेदांत', vijay: 'विजय', vikas: 'विकास', vikram: 'विक्रम', vinayak: 'विनायक',
  vinod: 'विनोद', viraj: 'विराज', vishal: 'विशाल', vishnu: 'विष्णू', vivek: 'विवेक', yash: 'यश', yogesh: 'योगेश', yuvraj: 'युवराज',
  // ---- first names (girls) ----
  aarti: 'आरती', aishwarya: 'ऐश्वर्या', ankita: 'अंकिता', anjali: 'अंजली', anushka: 'अनुष्का', aparna: 'अपर्णा', archana: 'अर्चना',
  ashwini: 'अश्विनी', bhagyashree: 'भाग्यश्री', deepali: 'दीपाली', divya: 'दिव्या', gauri: 'गौरी', grace: 'ग्रेस', jyoti: 'ज्योती',
  kajal: 'काजल', kavita: 'कविता', komal: 'कोमल', lata: 'लता', madhuri: 'माधुरी', mamta: 'ममता', manisha: 'मनीषा', meena: 'मीना',
  minal: 'मीनल', monika: 'मोनिका', neha: 'नेहा', nisha: 'निशा', pallavi: 'पल्लवी', pooja: 'पूजा', puja: 'पूजा', poonam: 'पूनम',
  prachi: 'प्राची', pranali: 'प्रणाली', priya: 'प्रिया', priyanka: 'प्रियांका', rani: 'राणी', rekha: 'रेखा', riya: 'रिया',
  rupali: 'रुपाली', sakshi: 'साक्षी', sanika: 'सानिका', sangita: 'संगीता', sarika: 'सारिका', shital: 'शीतल', sheetal: 'शीतल',
  shraddha: 'श्रद्धा', shruti: 'श्रुती', shweta: 'श्वेता', sneha: 'स्नेहा', snehal: 'स्नेहल', sonali: 'सोनाली', sujata: 'सुजाता',
  sunita: 'सुनीता', supriya: 'सुप्रिया', swati: 'स्वाती', tanvi: 'तन्वी', tejaswini: 'तेजस्विनी', usha: 'उषा', vaishnavi: 'वैष्णवी',
  vandana: 'वंदना', varsha: 'वर्षा', vidya: 'विद्या',
  // ---- surnames ----
  bhore: 'भोरे', bhosale: 'भोसले', bhosle: 'भोसले', chavan: 'चव्हाण', chougule: 'चौगुले', chaudhari: 'चौधरी', deshmukh: 'देशमुख',
  deshpande: 'देशपांडे', gaikwad: 'गायकवाड', ghorpade: 'घोरपडे', gokhale: 'गोखले', jadhav: 'जाधव', jagtap: 'जगताप', joshi: 'जोशी',
  kadam: 'कदम', kale: 'काळे', kamble: 'कांबळे', kulkarni: 'कुलकर्णी', kumbhar: 'कुंभार', mane: 'माने', mohite: 'मोहिते',
  more: 'मोरे', muchandi: 'मुचंडी', naik: 'नाईक', nayak: 'नायक', pandit: 'पंडित', patil: 'पाटील', pawar: 'पवार', powar: 'पोवार',
  phadke: 'फडके', randive: 'रणदिवे', salunkhe: 'साळुंखे', sawant: 'सावंत', shaikh: 'शेख', shinde: 'शिंदे', shirke: 'शिर्के',
  shelar: 'शेलार', sharma: 'शर्मा', suryawanshi: 'सूर्यवंशी', thakur: 'ठाकूर', thorat: 'थोरात', waghmare: 'वाघमारे', yadav: 'यादव',
  sutar: 'सुतार', lohar: 'लोहार', mali: 'माळी', dhanawade: 'धनवडे', kharat: 'खरात', mhetre: 'म्हेत्रे', ingale: 'इंगळे',
  // ---- places ----
  maharashtra: 'महाराष्ट्र', mumbai: 'मुंबई', pune: 'पुणे', nagpur: 'नागपूर', nashik: 'नाशिक', kolhapur: 'कोल्हापूर',
  sangli: 'सांगली', satara: 'सातारा', solapur: 'सोलापूर', ichalkaranji: 'इचलकरंजी', aurangabad: 'औरंगाबाद', latur: 'लातूर',
  ahmednagar: 'अहमदनगर', thane: 'ठाणे', miraj: 'मिरज', karad: 'कराड', jaysingpur: 'जयसिंगपूर', hatkanangale: 'हातकणंगले',
  ketkale: 'केतकाळे',
  // ---- common address / card words ----
  nagar: 'नगर', road: 'रोड', galli: 'गल्ली', chowk: 'चौक', colony: 'कॉलनी', peth: 'पेठ', wadi: 'वाडी', gaon: 'गाव',
  taluka: 'तालुका', tal: 'ता.', dist: 'जि.', district: 'जिल्हा', near: 'जवळ', school: 'शाळा', college: 'कॉलेज',
  class: 'इयत्ता', std: 'इयत्ता', roll: 'हजेरी', name: 'नाव', address: 'पत्ता', mobile: 'मोबाईल', blood: 'रक्त', group: 'गट',
  male: 'पुरुष', female: 'स्त्री', boy: 'मुलगा', girl: 'मुलगी', principal: 'मुख्याध्यापक', student: 'विद्यार्थी',
};
