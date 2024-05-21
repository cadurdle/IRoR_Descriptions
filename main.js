const basePath = 'https://cadurdle.github.io/IRoR_Descriptions/images';
const jsonPath = 'https://cadurdle.github.io/IRoR_Descriptions/study.json';

let experiment = {
    blocks: 12,
    imagesPerBlock: 54,
    congruentSets: 6,
    incongruentSets: 6,
    imageSets: [],
    currentBlock: 0,
    currentImage: 0,
    responses: []
};

console.log('Script loaded');

function fetchStudyJson() {
    console.log('Fetching study JSON');
    return fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            console.log('Fetched study JSON:', data);
            return data.imageSets;
        })
        .catch(error => {
            console.error('Error fetching study.json:', error);
            return [];
        });
}

function preloadImages(imageSets) {
    console.log('Preloading images');
    let promises = [];
    imageSets.forEach(set => {
        set.images.forEach(imageName => {
            let path = `${basePath}/${set.condition}/${set.setNumber}/${imageName}`;
            console.log('Preloading image:', path);
            promises.push(new Promise((resolve, reject) => {
                const img = new Image();
                img.src = path;
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Failed to load image at ${path}`));
            }));
        });
    });
    return Promise.all(promises);
}

function startTrials() {
    console.log('Starting trials');
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
    updateProgressBar();  // Update the progress bar
}

function displayImage(path, word) {
    console.log('Displaying image:', path, word);
    const experimentDiv = document.getElementById('experiment');
    experimentDiv.innerHTML = ''; // Clear previous content

    let topDiv = document.createElement('div');
    topDiv.style.display = 'flex';
    topDiv.style.flexDirection = 'column';
    topDiv.style.alignItems = 'center';
    topDiv.style.justifyContent = 'center';
    topDiv.style.flex = '0 0 auto'; // Adjust size

    let img = document.createElement('img');
    img.src = path;
    img.alt = word;
    img.style.display = 'block';
    img.style.margin = '0 auto';
    img.style.maxHeight = '300px'; // Adjust the size as needed
    img.style.maxWidth = '100%';   // Adjust the size as needed
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

fetchStudyJson()
    .then(imageSets => {
        console.log('Fetched image sets:', imageSets);
        imageSets.forEach(set => {
            set.images.forEach(imageName => {
                experiment.imageSets.push({
                    path: `${basePath}/${set.condition}/${set.setNumber}/${imageName}`,
                    word: formatWord(imageName),
                    condition: set.condition,
                    folder: set.setNumber
                });
            });
        });
        return preloadImages(imageSets);
    })
    .then(() => {
        console.log('Images preloaded');
        showInstructions();
    })
    .catch(error => {
        console.error('Error preloading images:', error);
    });

function formatWord(filename) {
    let name = filename.split('.jpg')[0];
    name = name.replace(/[0-9]/g, '');
    name = name.replace(/_/g, ' ');
    return name.toUpperCase();
}

function updateProgressBar() {
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressPercentage = (experiment.currentBlock * experiment.imagesPerBlock + experiment.currentImage) / (experiment.blocks * experiment.imagesPerBlock) * 100;
    progressBarFill.style.width = `${progressPercentage}%`;
}

function saveResponsesToFile() {
    console.log('Saving responses to file');
    let data = "image,word,detail1,detail2,detail3,detail4,condition,folder\n";
    experiment.responses.forEach(response => {
        data += `${response.image},${response.word},${response.detail1},${response.detail2},${response.detail3},${response.detail4},${response.condition},${response.folder}\n`;
    });

    const filename = `${experiment.participantName}_IRoR_Descriptions_${getFormattedDate()}.csv`;
    saveToFile(filename, data);
}

function getFormattedDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}${day}${year}`;
}

function saveToFile(filename, data) {
    let blob = new Blob([data], { type: 'text/csv' });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

function showInstructions() {
    console.log('Showing instructions');
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
    instructionsDiv.style.height = '100vh'; // Ensure instructions div takes full height

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
    console.log('Showing instruction pages');
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
