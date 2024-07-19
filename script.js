const socket = io();
let isAdmin = false;
let countdownInterval;

function joinGame() {
    const name = document.getElementById('name').value;
    if (name) {
      socket.emit('join', name);
      document.getElementById('nameInput').style.display = 'none';
      document.getElementById('game').style.display = 'block';
    }
}

socket.on('joinFailed', (message) => {
    document.getElementById('joinStatus').textContent = message;
    // Prompt the user to enter a new name
    const newName = prompt("This name is already taken. Please enter a different name:");
    if (newName) {
      document.getElementById('name').value = newName;
      joinGame();
    }
  });

socket.on('question', (data) => {
    if(data.percent==='1%'){
      document.getElementById('skipQuestion').style.display = 'none';
    }

    document.getElementById('precent').textContent=data.percent
    document.getElementById('precent').style.color = 'red'

    const questionImage = document.getElementById('questionImage');
    questionImage.src = data.question;
    questionImage.style.display = 'block';

    const answerContainer = document.getElementById('answerContainer')
    answerContainer.style.display = 'block';

    if(data.type==='multiple-choice'){
      document.getElementById('answer').style.display='none'
      document.getElementById('submitAnswer').style.display='none'
      const optionsContainer = document.createElement('div');
      optionsContainer.id='options-container'
      optionsContainer.className = 'options-container';
      data.options.forEach(option => {
        const optionButton = document.createElement('button');
        optionButton.textContent = option;
        optionButton.className = 'option-button';
        optionButton.onclick = () => submitAnswer(option);
        optionsContainer.appendChild(optionButton);
      });
      document.getElementById('answerContainer').appendChild(optionsContainer);
    }

    else if(data.type==='one-option'){
      document.getElementById('answer').style.display='block'
      document.getElementById('submitAnswer').style.display='inline'
    }

    startCountdown(30);
});

socket.on('answerRevealed', (data) => {
  const questionImage = document.getElementById('questionImage');
  questionImage.src = data.showAnswer;
  questionImage.style.display = 'block';
  const statusElement = document.getElementById('status');
  statusElement.textContent = `Correct answer: ${data.correctAnswer}`;
});

socket.on('clearAnswer', () => {
  const optionsContainer=document.getElementById('options-container')
  if(optionsContainer){
    document.getElementById('answerContainer').removeChild(optionsContainer);
  }
  document.getElementById('status').textContent = '';
});

socket.on('nextQuestionPreview', (data) => {
    const questionImage = document.getElementById('questionImage');
    questionImage.src = data.question;
    questionImage.style.display = 'block';
});

socket.on('hideAnswerContainer',()=>{
    const answerContainer = document.getElementById('answerContainer')
    answerContainer.style.display = 'none';
    document.getElementById('status').textContent = 'התשובה התקבלה בסיום הזמן תגלה עם עלית לסיבוב הבא או לא';
})

socket.on('successRound',()=>{
  document.getElementById('status').textContent = "התקדמת לסיבוב הבא";
})

socket.on('kickout', () => {
    document.getElementById('status').textContent = "הסיבוב לא עברת בהצלחה פעם הבאה";
    document.getElementById('answer').disabled = true;
    document.querySelector('button').disabled = true;
});

socket.on('updatePlayers', (data) => {
  const playersWithSkipList = document.getElementById('playersWithSkipList');
  const playersWithoutSkipList = document.getElementById('playersWithoutSkipList');
  playersWithSkipList.innerHTML = '';
  playersWithoutSkipList.innerHTML = '';

  data.withSkip.forEach(player => {
    const li = document.createElement('li');
    li.textContent = `${player.name} (${player.time.toFixed(2)}s)`;
    li.classList.add('slide-in');
    playersWithSkipList.appendChild(li);
  });

  data.withoutSkip.forEach(player => {
    const li = document.createElement('li');
    li.textContent = `${player.name} (${player.time.toFixed(2)}s)`;
    li.classList.add('slide-in');
    playersWithoutSkipList.appendChild(li);
  });

  document.getElementById('withSkipCount').textContent = data.withSkip.length;
  document.getElementById('withoutSkipCount').textContent = data.withoutSkip.length;

  document.getElementById('playerCount').textContent =data.withSkip.length+ data.withoutSkip.length;
});

socket.on('updateKickedOutCount', (count) => {
  document.getElementById('kickedOutCount').textContent = count;
});

socket.on('gameOver', (message) => {
    document.getElementById('status').textContent = message;
    document.getElementById('answer').disabled = true;
    document.querySelector('button').disabled = true;
});

socket.on('revealTop5Players', (top5Players) => {
  document.getElementById('game').style.display='none'
  const topPlayersList = document.getElementById('top-players-list');
  topPlayersList.innerHTML = '';
  let index=0
  top5Players.forEach(player => {
    index++
    const listItem = document.createElement('li');
    listItem.textContent = `${player.username} - מקום: ${index}, הגיע לשאלת ה -  ${player.percent},זמן ממוצא לשאלה:${player.totalTime/player.correctAnswers}`;
    topPlayersList.appendChild(listItem);
  });
  document.getElementById('top-players').style.display = 'block';
})

function submitAnswer(answer) {
    if(answer){
      socket.emit('answer', answer);
    }
    else{
      const oneOptionAnswer = document.getElementById('answer').value;
      socket.emit('answer', oneOptionAnswer);
    }
    clearInterval(countdownInterval);
}

function revealAnswer() {
  socket.emit('revealAnswer');
}

function previewNextQuestion() {
  socket.emit('previewNextQuestion');
}

function nextQuestion() {
    socket.emit('nextQuestion');
}

function startCountdown(seconds) {
    let remainingTime = seconds;
    document.getElementById('timer').textContent = `Time remaining: ${remainingTime} seconds`;
    countdownInterval = setInterval(() => {
      remainingTime--;
      document.getElementById('timer').textContent = `Time remaining: ${remainingTime} seconds`;
      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);
}

function skipQuestion() {
  socket.emit('skipQuestion');
  document.getElementById('status').textContent = "You've used your skip for this game.";
  document.getElementById('skipQuestion').style.display = 'none';
}

function togglePlayerJoin() {
    socket.emit('togglePlayerJoin');
}

function startGame() {
    socket.emit('startGame');
}

function RevealTop5Players(){
  socket.emit('revealTop5Players')
}

function adminLogin() {
    const password = prompt("Enter admin password:");
    if (password === "0553053388") {
      isAdmin = true;
      socket.emit('adminLogin');
      document.querySelector('.admin-controls').style.display = 'block';
    } else {
      alert("Incorrect password!");
    }
}

window.onload = adminLogin;

socket.on('playerJoinToggle', (canJoin) => {
    const status = canJoin ? 'enabled' : 'disabled';
    alert(`Player joining is now ${status} by admin.`);
});