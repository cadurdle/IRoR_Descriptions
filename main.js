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
            let path = `${basePath}/${set.condition}_resources/${set.setNumber}/${imageName}`;
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
    createInputFields(4, set);
    updateProgressBar();
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
}

function createInputFields(number, set) {
    const experimentDiv = document.getElementById('experiment');
    experimentDiv.innerHTML = ''; // Clear previous content
    experimentDiv.style.display = 'flex';
    experimentDiv.style.flexDirection = 'column';
    experimentDiv.style.justifyContent = 'center';
    experimentDiv.style.alignItems = 'center';
    experimentDiv.style.height = '90vh'; // Adjust height to make room for progress bar

    // Ensure image and word are displayed in the top half
    let topDiv = document.createElement('div');
    topDiv.style.display = 'flex';
    topDiv.style.flexDirection = 'column';
    topDiv.style.alignItems = 'center';
    topDiv.style.justifyContent = 'center';
    topDiv.style.flex = '0 0 auto'; // Adjust size

    let img = document.createElement('img');
    img.src = set.path;
    img.alt = set.word;
    img.style.display = 'block';
    img.style.maxHeight = '375px'; // Adjust the size as needed
    img.style.maxWidth = '100%';   // Adjust the size as needed
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
    bottomDiv.style.flex = '1'; // Adjust size

    for (let i = 0; i < number; i++) {
        let container = document.createElement('div');
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.marginBottom = '15px'; // Increased space between input containers

        let label = document.createElement('label');
        label.innerText = `Detail ${i + 1}`;
        label.style.color = 'white';
        label.style.marginRight = '10px';
        label.setAttribute('for', `detail${i + 1}`);

        let input = document.createElement('input');
        input.type = 'text';
        input.id = `detail${i + 1}`;
        input.name = `detail${i + 1}`;
        input.autocomplete = 'off';
        input.style.flex = '1';
        input.style.width = '300px'; // Adjusted width
        input.style.height = '20px'; // Adjusted height

        container.appendChild(label);
        container.appendChild(input);
        bottomDiv.appendChild(container);
    }
    experimentDiv.appendChild(bottomDiv);

    createButton('Submit', () => saveResponse(set));
}

function createButton(text, onClick) {
    const experimentDiv = document.getElementById('experiment');
    let button = document.createElement('button');
    button.innerText = text;
    button.style.marginTop = '20px';
    button.style.padding = '10px 20px';
    button.onclick = onClick;
    experimentDiv.appendChild(button);
}

function saveResponse(set) {
    const details = [];
    for (let i = 1; i <= 4; i++) {
        const detail = document.getElementById(`detail${i}`).value.trim();
        details.push(detail);
    }

    // Save the response
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

    // Move to the next image
    experiment.currentImage++;
    if (experiment.currentImage >= experiment.imagesPerBlock) {
        experiment.currentImage = 0;
        experiment.currentBlock++;
    }
    showNextImage();
}

fetchStudyJson()
    .then(imageSets => {
        console.log('Fetched image sets:', imageSets);
        imageSets.forEach(set => {
            set.images.forEach(imageName => {
                experiment.imageSets.push({
                    path: `${basePath}/${set.condition}_resources/${set.setNumber}/${imageName}`,
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
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function updateProgressBar() {
    const progressBarContainer = document.getElementById('progress-bar-container');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressLabel = document.getElementById('progress-label');

    if (experiment.currentBlock >= experiment.blocks) {
        progressBarContainer.style.display = 'none';
        return;
    }

    progressBarContainer.style.display = 'block';

    const totalImages = experiment.blocks * experiment.imagesPerBlock;
    const currentProgress = experiment.currentBlock * experiment.imagesPerBlock + experiment.currentImage + 1;
    const progressPercentage = (currentProgress / totalImages) * 100;

    progressBarFill.style.width = `${progressPercentage}%`;
    progressLabel.innerText = `Progress: ${currentProgress}/${totalImages}`;
}

function endExperiment() {
    console.log('Experiment ended');
    // You can implement the code to show a message to the participant or save their responses.
}

function showInstructions() {
    const instructionsDiv = document.getElementById('instructions');
    const pages = [
        "Welcome to the experiment. In this study, you will be asked to describe images presented to you.<br><br>Click Next to continue.",
        "The task is as follows:<br>An image will be presented on the screen with a word describing the image. Your task is to type four unique details that describe the image in the text boxes.<br><br>Examples of descriptions for the word “Ball” are:<br>1. It’s round.<br>2. It’s made of rubber.<br>3. It’s used in sports.<br>4. It bounces.",
        "A few things to keep in mind:<br>Type only one detail per line.<br>Details should be specific, informative, and accurate.<br>You will not be able to go back and change your answers.<br>There is no back button. You can only move forward through the task.<br>A progress bar is displayed at the bottom of the screen.<br>Please feel free to take breaks as needed.",
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
