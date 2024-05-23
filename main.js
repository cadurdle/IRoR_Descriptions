const API_KEY = 'AIzaSyCEGEi3s9QcvzfPqAKRh3z8Vp3rTzQ-zZk';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let experiment = {
  blocks: 12,
  imagesPerBlock: 54,
  congruentSets: 6,
  incongruentSets: 6,
  imageSets: [],
  currentBlock: 0,
  currentImage: 0,
  responses: [],
  participantName: ''
};

let typo;

function fetchStudyData() {
  return fetch('/IRoR_Descriptions/study.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      return data.imageSets;
    })
    .catch(error => {
      console.error('Error fetching study data:', error);
      return [];
    });
}

function preloadImages(imageSets) {
  imageSets.forEach(set => {
    set.images.sort();
    set.images.forEach(image => {
      let path = `/IRoR_Descriptions/images/${set.condition}/${set.setNumber}/${image}`;
      let word = formatWord(image);
      experiment.imageSets.push({
        path: path,
        word: word,
        condition: set.condition,
        folder: set.setNumber
      });
    });
  });
  return Promise.resolve();
}

function formatWord(filename) {
  let name = filename.split('.jpg')[0];
  name = name.replace(/[0-9]/g, '');
  name = name.replace(/_/g, ' ');
  return name.toUpperCase();
}

function showInstructions() {
  const instructionsDiv = document.getElementById('instructions');
  instructionsDiv.innerHTML = `
    <div class="instructions-content">
      <p>Welcome to the Experiment!<br>Please enter your name and press Start.</p>
      <label for="participantName">Name:</label>
      <input type="text" id="participantName" name="participantName" autocomplete="name" style="width: 300px; height: 30px; margin-top: 10px; margin-bottom: 20px;">
      <button class="next-button" id="startButton">Start</button>
    </div>
  `;
  instructionsDiv.style.display = 'flex';
  instructionsDiv.style.flexDirection = 'column';
  instructionsDiv.style.justifyContent = 'center';
  instructionsDiv.style.alignItems = 'center';
  instructionsDiv.style.height = '100vh';

  const startButton = document.getElementById('startButton');
  startButton.onclick = () => {
    const nameInput = document.getElementById('participantName').value;
    if (nameInput.trim() === '') {
      alert('Please enter your name to start the experiment.');
      return;
    }
    experiment.participantName = nameInput;
    showInstructionPages();
  };
}

function showInstructionPages() {
  const instructionsDiv = document.getElementById('instructions');
  let pages = [
    "Please make sure your internet window is full screen for this task.<br><br>Presentation may be affected by resized windows.<br><br>Please hit next.",
    "In this computer task, you will see various images.<br><br>We are trying to understand what details people value the most when they remember something.<br><br>However, this is not a memory task.<br>We simply want to know what details of the image stand out to you.",
    "In the task, you will see an image, a word in orange font to describe the image, and four text boxes below the image.<br><br>You need to describe each image using four essential details, one detail per text box.<br><br>Details can include many things, some examples to describe the image may be colors, shapes, textures, materials, environments, etc.<br>You can use 1 - 3 words per detail entry.<br><br>Please do not use the word in orange below the image in the details you list.",
    "Keep in mind, that people in our next task will see the same images for 2 seconds at a time and have to recall them. We will be using the key details you provide to measure these next participants' performance.<br><br>Again, please give us 4 details you feel are essential to describe the image.<br><br>Remember, do not use the word in orange.",
    "Please go as quickly as possible because participants in the next task will only see the image for a couple of seconds.<br><br>There are many images to get through.<br>Please pay close attention to spelling before submitting your detail descriptions.<br><br>There is no back button. You can only move forward through the task.<br>A progress bar is displayed at the bottom of the screen.<br>Please feel free to take breaks as needed.",
    "Thank you for your time, effort, patience, and attention to detail!<br><br>Please hit Next to begin."
  ];
  let currentPage = 0;

  function showPage(pageIndex) {
    if (pageIndex < pages.length) {
      instructionsDiv.innerHTML = `
        <div class="instructions-content">
          <p>${pages[pageIndex]}</p>
          <button class="next-button">Next</button>
        </div>
      `;
      const nextButton = instructionsDiv.querySelector('.next-button');
      nextButton.onclick = () => showPage(pageIndex + 1);
    } else {
      instructionsDiv.innerHTML = '';
      document.getElementById('experiment').style.display = 'flex';
      startTrials();
    }
  }

  showPage(currentPage);
}

function startTrials() {
  console.log('Starting trials');
  document.getElementById('progress-bar-container').style.display = 'flex';
  showNextImage();
}

function showNextImage() {
  console.log('Showing next image');
  if (experiment.currentBlock >= experiment.blocks) {
    endExperiment();
    return;
  }

  let setIndex = experiment.currentBlock * experiment.imagesPerBlock + experiment.currentImage;
  if (setIndex >= experiment.imageSets.length) {
    console.error('Set index out of bounds:', setIndex);
    return;
  }
  let set = experiment.imageSets[setIndex];
  console.log(`Displaying image from path: ${set.path}`);
  displayImage(set.path, set.word);
  createInputFields(4, set);
  updateProgressBar();
}

function createInputFields(number, set) {
  const experimentDiv = document.getElementById('experiment');
  experimentDiv.innerHTML = '';
  experimentDiv.style.display = 'flex';
  experimentDiv.style.flexDirection = 'column';
  experimentDiv.style.justifyContent = 'center';
  experimentDiv.style.alignItems = 'center';
  experimentDiv.style.height = '90vh';

  let topDiv = document.createElement('div');
  topDiv.style.display = 'flex';
  topDiv.style.flexDirection = 'column';
  topDiv.style.alignItems = 'center';
  topDiv.style.justifyContent = 'center';
  topDiv.style.flex = '0 0 auto';

  let img = document.createElement('img');
  img.src = set.path;
  img.alt = set.word;
  img.style.display = 'block';
  img.style.maxHeight = '375px';
  img.style.maxWidth = '100%';
  img.onerror = () => console.error(`Failed to load image at ${img.src}`);

  let wordElement = document.createElement('div');
  wordElement.innerText = set.word;
  wordElement.style.color = 'orange';
  wordElement.style.fontSize = '24px';
  wordElement.style.marginTop = '15px';
  wordElement.style.marginBottom = '15px';

  topDiv.appendChild(img);
  topDiv.appendChild(wordElement);

  experimentDiv.appendChild(topDiv);

  let bottomDiv = document.createElement('div');
  bottomDiv.style.display = 'flex';
  bottomDiv.style.flexDirection = 'column';
  bottomDiv.style.alignItems = 'center';
  bottomDiv.style.justifyContent = 'center';
  bottomDiv.style.flex = '1';

  for (let i = 0; i < number; i++) {
    let container = document.createElement('div');
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.marginBottom = '15px';

    let label = document.createElement('label');
    label.innerText = `Detail ${i + 1}`;
    label.style.color = 'white';
    label.style.marginRight = '10px';
    label.setAttribute('for', `detail${i + 1}`);

    let input = document.createElement('input');
    input.type = 'text';
    input.id = `detail${i + 1}`;
    input.name = `detail${i + 1}`;
    input.autocomplete = `off`;
    input.style.flex = '1';
    input.style.width = '300px';
    input.style.height = '20px';

    container.appendChild(label);
    container.appendChild(input);
    bottomDiv.appendChild(container);
  }
  experimentDiv.appendChild(bottomDiv);

  createButton('Submit', () => saveResponse(set));
}

function createButton(text, onClick) {
  let button = document.createElement('button');
  button.innerText = text;
  button.onclick = onClick;
  button.className = 'submit-button';
  document.getElementById('experiment').appendChild(button);
}

function displayImage(path, word) {
  console.log(`Displaying image: ${path}`);
  const experimentDiv = document.getElementById('experiment');
  experimentDiv.innerHTML = '';

  let topDiv = document.createElement('div');
  topDiv.style.display = 'flex';
  topDiv.style.flexDirection = 'column';
  topDiv.style.alignItems = 'center';
  topDiv.style.justifyContent = 'center';
  topDiv.style.flex = '0 0 auto';

  let img = document.createElement('img');
  img.src = path;
  img.alt = word;
  img.style.display = 'block';
  img.style.margin = '0 auto';
  img.style.maxHeight = '300px';
  img.style.maxWidth = '100%';
  img.onerror = () => console.error(`Failed to load image at ${path}`);

  let wordElement = document.createElement('div');
  wordElement.innerText = word;
  wordElement.style.color = 'orange';
  wordElement.style.fontSize = '24px';
  wordElement.style.marginTop = '20px';
  wordElement.style.marginBottom = '20px';

  topDiv.appendChild(img);
  topDiv.appendChild(wordElement);

  experimentDiv.appendChild(topDiv);
  createInputFields(4, { path: path, word: word });
}

function validateDetails(details, word) {
  console.log('Validating details');
  if (details.length !== 4) return false;

  let detailSet = new Set();
  let invalidDetails = [];

  for (let detail of details) {
    let detailText = detail.trim();
    if (!detailText || detailText.toUpperCase() === word.toUpperCase()) return false;

    let words = detailText.split(' ');
    words.forEach(word => {
      if (!typo.check(word)) {
        invalidDetails.push(word);
      }
    });

    detailSet.add(detailText.toUpperCase());
  }

  if (detailSet.size !== details.length) return false;

  if (invalidDetails.length > 0) {
    alert(`The following words may have typos or be invalid: ${invalidDetails.join(', ')}. Please check your entries.`);
    return false;
  }

  return true;
}

function saveResponse(set) {
  console.log('Saving response');
  let details = [];
  let invalidDetails = [];
  let typo = new Typo('en_US', undefined, undefined, { dictionaryPath: '/IRoR_Descriptions/typo/dictionaries' });

  for (let i = 1; i <= 4; i++) {
    let detail = document.getElementById(`detail${i}`).value.trim();
    details.push(detail);

    let words = detail.split(' ');
    words.forEach(word => {
      if (!typo.check(word)) {
        invalidDetails.push(word);
      }
    });
  }

  if (invalidDetails.length > 0) {
    alert(`The following words may have typos or be invalid: ${invalidDetails.join(', ')}. Please check your entries.`);
    return;
  }

  let data = {
    participantName: experiment.participantName,
    image: set.path,
    word: set.word,
    detail1: details[0],
    detail2: details[1],
    detail3: details[2],
    detail4: details[3],
    condition: set.condition,
    folder: set.folder
  };

  gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: '1ZYTUoNtiYZLz7mFB1NxF_uYQ4RipcyDy_Vw_cBHmnI8',
    range: 'IRoR_Description_FR_Output!A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [
        [data.participantName, data.image, data.word, data.detail1, data.detail2, data.detail3, data.detail4, data.condition, data.folder]
      ]
    }
  }).then(response => {
    console.log('Data saved successfully', response);
  }, error => {
    console.error('Error saving data', error);
  });

  experiment.currentImage++;
  if (experiment.currentImage >= experiment.imagesPerBlock) {
    experiment.currentImage = 0;
    experiment.currentBlock++;
  }
  showNextImage();
}

function endExperiment() {
  console.log('Ending experiment');
  showThankYouMessage();
  saveResponsesToFile();
}

function showThankYouMessage() {
  displayText("Thank you for participating!", 'instructions');
}

function displayText(text, elementId) {
  const element = document.getElementById(elementId);
  element.innerText = text;
  element.style.color = 'white';
}

function updateProgressBar() {
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressPercentage = (experiment.currentBlock * experiment.imagesPerBlock + experiment.currentImage) / (experiment.blocks * experiment.imagesPerBlock) * 100;
  progressBarFill.style.width = `${progressPercentage}%`;
}

function saveResponsesToFile() {
  console.log('Saving responses to file');
  let data = "participantName,image,word,detail1,detail2,detail3,detail4,condition,folder\n";
  experiment.responses.forEach(response => {
    data += `${response.participantName},${response.image},${response.word},${response.detail1},${response.detail2},${response.detail3},${response.detail4},${response.condition},${response.folder}\n`;
  });

  const filename = `${experiment.participantName}_IRoR_Descriptions_${getFormattedDate()}.csv`;
  saveToFile(filename, data);
}

function saveToFile(filename, data) {
  let blob = new Blob([data], { type: 'text/csv' });
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function getFormattedDate() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}${day}${year}`;
}
