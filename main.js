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

function fetchImages(condition, setNumber) {
    console.log(`Fetching images from /images/${condition}/${setNumber}`);
    return fetch(`/images/${condition}/${setNumber}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(images => {
            console.log(`Fetched images for ${condition} ${setNumber}:`, images);
            return images;
        })
        .catch(error => {
            console.error('Error fetching images:', error);
            return [];
        });
}

function preloadImages() {
    let promises = [];
    for (let i = 1; i <= experiment.congruentSets; i++) {
        promises.push(loadImagesFromPath('congruent', `studyset${i}`));
    }
    for (let i = 1; i <= experiment.incongruentSets; i++) {
        promises.push(loadImagesFromPath('incongruent', `studyset${i}`));
    }
    return Promise.all(promises);
}

function loadImagesFromPath(condition, set) {
    return fetchImages(condition, set).then(images => {
        images.forEach(image => {
            let word = formatWord(image);
            experiment.imageSets.push({
                path: `/images/${condition}/${set}/${image}`,
                word: word,
                condition: condition,
                folder: set
            });
        });
        console.log(`Loaded images from ${condition}_resources/${set}`);
    });
}

function formatWord(filename) {
    let name = filename.split('.jpg')[0];
    name = name.replace(/[0-9]/g, '');
    name = name.replace(/_/g, ' ');
    return name.toUpperCase();
}

function showInstructions() {
    console.log('Showing instructions');
    const instructionsDiv = document.getElementById('instructions');
    instructionsDiv.innerHTML = `
        <div class="instructions-content">
            Welcome to the Experiment! Please press start.
        </div>
    `;
    waitForUserInput(showInstructionPages);
}

function showInstructionPages() {
    const instructionsDiv = document.getElementById('instructions');
    let pages = [
        "In this experiment, you will see various images. We are trying to understand what details people value the most when they remember something.",
        "You need to describe each image using four essential details. Please do not use the word in orange to describe the image.",
        "Click 'Next' to see the next set of instructions.",
        "Give us 4 details you feel are essential to describe the image. Remember, do not use the word in orange."
    ];
    let currentPage = 0;

    function showPage(pageIndex) {
        if (pageIndex < pages.length) {
            instructionsDiv.innerHTML = `
                <div class="instructions-content">
                    ${pages[pageIndex]}
                    <button class="next-button">Next</button>
                </div>
            `;
            const nextButton = instructionsDiv.querySelector('.next-button');
            nextButton.onclick = () => showPage(pageIndex + 1);
        } else {
            instructionsDiv.innerHTML = '';
            startExperiment();
        }
    }

    showPage(currentPage);
}

function startExperiment() {
    console.log('Starting experiment');
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
}

function createInputFields(number, set) {
    const experimentDiv = document.getElementById('experiment');
    experimentDiv.innerHTML = ''; // Clear previous content
    experimentDiv.style.display = 'flex';
    experimentDiv.style.flexDirection = 'column';
    experimentDiv.style.alignItems = 'center';
    experimentDiv.style.justifyContent = 'center';
    experimentDiv.style.height = '100vh';

    let topDiv = document.createElement('div');
    topDiv.style.display = 'flex';
    topDiv.style.flexDirection = 'column';
    topDiv.style.alignItems = 'center';
    topDiv.style.justifyContent = 'center';
    topDiv.style.marginBottom = '20px';

    let img = document.createElement('img');
    img.src = set.path;
    img.alt = set.word;
    img.style.display = 'block';
    img.style.maxHeight = '300px';
    img.style.maxWidth = '100%';
    img.onerror = () => console.error(`Failed to load image at ${img.src}`);

    let wordElement = document.createElement('div');
    wordElement.innerText = set.word;
    wordElement.classList.add('word');

    topDiv.appendChild(img);
    topDiv.appendChild(wordElement);

    experimentDiv.appendChild(topDiv);

    let bottomDiv = document.createElement('div');
    bottomDiv.style.display = 'flex';
    bottomDiv.style.flexDirection = 'column';
    bottomDiv.style.alignItems = 'center';
    bottomDiv.style.marginTop = '10px';

    for (let i = 0; i < number; i++) {
        let container = document.createElement('div');
        container.classList.add('input-container');

        let label = document.createElement('label');
        label.innerText = `Detail ${i + 1}`;

        let input = document.createElement('input');
        input.type = 'text';
        input.id = `detail${i + 1}`;

        container.appendChild(label);
        container.appendChild(input);
        bottomDiv.appendChild(container);
    }
    experimentDiv.appendChild(bottomDiv);

    createButton('Submit', () => saveResponse(set));
}

function saveResponse(set) {
    console.log('Saving response');
    let details = [];
    for (let i = 1; i <= 4; i++) {
        details.push(document.getElementById(`detail${i}`).value);
    }

    if (validateDetails(details, set.word)) {
        experiment.responses.push({
            image: set.path,
            word: set.word,
            detail1: details[0],
            detail2: details[1],
            detail3: details[2],
            detail4: details[3],
            condition: set.condition,
            folder: set.folder
        });
        experiment.currentImage++;
        if (experiment.currentImage >= experiment.imagesPerBlock) {
            experiment.currentImage = 0;
            experiment.currentBlock++;
        }
        showNextImage();
    } else {
        alert('Please provide four valid details. Do not use the descriptor word.');
    }
}

function validateDetails(details, word) {
    console.log('Validating details');
    if (details.length !== 4) return false;
    for (let detail of details) {
        if (detail.trim().toUpperCase() === word) return false;
    }
    return true;
}

function saveResponsesToFile() {
    console.log('Saving responses to file');
    let data = "image,word,detail1,detail2,detail3,detail4,condition,folder\n";
    experiment.responses.forEach(response => {
        data += `${response.image},${response.word},${response.detail1},${response.detail2},${response.detail3},${response.detail4},${response.condition},${response.folder}\n`;
    });

    saveToFile('responses.csv', data);
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

function displayImage(path, word) {
    console.log(`Displaying image: ${path}`);
    const experimentDiv = document.getElementById('experiment');
    experimentDiv.innerHTML = ''; // Clear previous content

    let topDiv = document.createElement('div');
    topDiv.style.display = 'flex';
    topDiv.style.flexDirection = 'column';
    topDiv.style.alignItems = 'center';
    topDiv.style.justifyContent = 'center';
    topDiv.style.marginBottom = '20px';

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
    wordElement.classList.add('word');

    topDiv.appendChild(img);
    topDiv.appendChild(wordElement);

    experimentDiv.appendChild(topDiv);
    createInputFields(4, { path: path, word: word });
}

function createButton(text, onClick) {
    let button = document.createElement('button');
    button.innerText = text;
    button.onclick = onClick;
    button.classList.add('submit-button');
    document.getElementById('experiment').appendChild(button);
}

function waitForUserInput(callback) {
    const instructionsDiv = document.getElementById('instructions');
    const button = document.createElement('button');
    button.innerText = 'Start';
    button.onclick = callback;
    button.classList.add('next-button');
    instructionsDiv.innerHTML = ''; // Clear previous content
    instructionsDiv.appendChild(button);
}

function saveToFile(filename, data) {
    let blob = new Blob([data], { type: 'text/csv' });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

// Start by preloading images and then showing instructions
preloadImages().then(() => {
    console.log('Images preloaded');
    showInstructions();
}).catch(error => {
    console.error('Error preloading images:', error);
});
