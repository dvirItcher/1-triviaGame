const { log } = require('console');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

let canPlayersJoin = true; // Flag to control player joining

let currentQuestionIndex = 0;
const questions = [
    { type: 'multiple-choice', question: '../images/q19.png', options: ['א', 'ב', 'ג'],correctAnswer: 'ב',showAnswer: '../images/a19.png',percent:'100%' },
    { type: 'one-option', question: '../images/q22.png' ,correctAnswer: 'בול עץ',showAnswer: '../images/a22.png',percent:'100%' },
    { type: 'multiple-choice', question:'../images/q1.png' , options: ['א', 'ב', 'ג', 'ד'],correctAnswer: 'ג',showAnswer: '../images/a1.png',percent:'90%' },
    { type: 'multiple-choice', question: '../images/q18.png', options: ['א', 'ב', 'ג','ד'],correctAnswer: 'ב',showAnswer: '../images/a18.png',percent:'80%' },
    { type: 'one-option', question: '../images/q15.png', correctAnswer: 'לקרוא בין השורות',showAnswer: '../images/a15.png',percent:'70%' },
    { type: 'multiple-choice', question: '../images/q9.png',options: ['א', 'ב', 'ג'], correctAnswer: "א",showAnswer: '../images/a9.png',percent:'60%' },
    { type: 'multiple-choice', question: '../images/q12.png',options: ['א', 'ב', 'ג','ד'], correctAnswer: 'ב',showAnswer: '../images/a12.png',percent:'50%' },
    { type: 'multiple-choice', question: '../images/q10.png',options: ['א', 'ב', 'ג','ד'], correctAnswer: "ד",showAnswer: '../images/a10.png',percent:'45%' },
    { type: 'multiple-choice', question: '../images/q20.png', options: ['א', 'ב', 'ג','ד'],correctAnswer: 'ג',showAnswer: '../images/a20.png',percent:'40%' },
    { type: 'one-option', question: '../images/q7.png', correctAnswer: "24",showAnswer: '../images/a7.png',percent:'35%' },
    { type: 'one-option', question: '../images/q11.png', correctAnswer: 'ת',showAnswer: '../images/a11.png',percent:'30%' },
    { type: 'one-option', question: '../images/q23.png' ,correctAnswer: 'מעיין',showAnswer: '../images/a23.png',percent:'25%' },
    { type: 'one-option', question: '../images/q6.png', correctAnswer: "120",showAnswer: '../images/a6.png',percent:'20%' },
    { type: 'one-option', question: '../images/q14.png', correctAnswer: 'פיצה',showAnswer: '../images/a14.png',percent:'15%' },
    { type: 'multiple-choice', question: '../images/q4.png',options: ['א', 'ב', 'ג', 'ד'], correctAnswer: "ב",showAnswer: '../images/a4.png',percent:'10%' },
    { type: 'one-option', question: '../images/q25.png' ,correctAnswer: 'ע',showAnswer: '../images/a25.png',percent:'5%' },
    { type: 'one-option', question: '../images/q17.png', correctAnswer: '1',showAnswer: '../images/a17.png',percent:'1%' },
];

// Add a variable to track the next question index to preview
let nextQuestionIndex = 0; // Assuming the first question is already shown

let players = [];
let adminSocketId1 = null;
let adminSocketId2 = null;
let answerTimeout;
let answeredCorrectly = new Set();

const playersWithSkip = new Set();
const playersWithoutSkip = new Set();

let questionStartTime = null; // Track the time when the question was sent
let playerTimes = new Map(); // Track the time taken by each player to answer

let kickedOutCount = 0; // Track the number of kicked-out players

const playerPerformance = {};

function updatePlayers() {
    const playersWithSkipArray = Array.from(playersWithSkip).map(name => ({name,time: playerTimes.get(name) || 0})).sort((a, b) => a.time - b.time);
    const playersWithoutSkipArray = Array.from(playersWithoutSkip).map(name => ({name,time: playerTimes.get(name) || 0})).sort((a, b) => a.time - b.time);
    io.emit('updatePlayers', {
      withSkip: playersWithSkipArray,
      withoutSkip: playersWithoutSkipArray
    });
}

function getTopPlayers() {
    const sortedPlayers = Object.keys(playerPerformance).map(username => ({username,...playerPerformance[username]})).sort((a, b) => b.correctAnswers - a.correctAnswers || a.totalTime - b.totalTime).slice(0, 5);
    return sortedPlayers;
}

function sendQuestion() {
    if (currentQuestionIndex < questions.length) {
        io.emit('question', questions[currentQuestionIndex]);
        canUpdateTop5Players=false
        answeredCorrectly.clear();

        playerTimes=new Map()
        updatePlayers()

        // Start the answer timeout
        if (answerTimeout) clearTimeout(answerTimeout);
        questionStartTime = new Date().getTime();
        answerTimeout = setTimeout(() => {
            players.forEach(player => {
                const socket = io.sockets.sockets.get(player.id);
                if (!answeredCorrectly.has(player.id) && player.id !== adminSocketId1  && player.id !== adminSocketId2 && questions[currentQuestionIndex].percent !== '100%') {
                    if (socket) {
                        socket.emit('kickout');
                        socket.disconnect();
                        players = players.filter(p => p.id !== player.id);
                        playersWithSkip.delete(player.name);
                        playersWithoutSkip.delete(player.name);
                        updatePlayers();
                    }
                }
            socket.emit('successRound')
            });
        }, 30000);
        canUpdateTop5Players=true
        updatePlayers()
    } else {
      io.emit('gameOver', 'The game is over. Thanks for playing!');
    }
}

function sendNextQuestionToAdmin() {
    if (nextQuestionIndex < questions.length) {
      const nextQuestion = questions[nextQuestionIndex];
      io.to(adminSocketId1).to(adminSocketId2).emit('nextQuestionPreview', nextQuestion);
    } else {
      io.to(adminSocketId1,adminSocketId2).emit('gameOver', 'No more questions.');
    }
}

io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);
    socket.on('join', (name) => {
        if (!canPlayersJoin) {
            socket.emit('joinFailed', 'Joining is currently disabled by admin.');
            socket.disconnect();
            return;
        }

        if (players.some(player => player.name === name)) {
            socket.emit('joinFailed', 'This name is already taken.');
            return;
        }

        players.push({ id: socket.id, name: name });
        if(socket.id!==adminSocketId1&&socket.id!==adminSocketId2){
            playersWithSkip.add(name);
            playerPerformance[name] = { correctAnswers: 0, totalTime: 0 ,percent: '100%'};
        }
        updatePlayers();
    });

socket.on('answer', (answer) => {
    const player = players.find(p => p.id === socket.id);
    if (!player) return;

    
    if (socket.id === adminSocketId1||socket.id === adminSocketId2) {
        console.log(`Admin (${player.name}) attempted to answer a question.`);
        return; // Prevent admin from answering questions
    }

    if (answer === questions[currentQuestionIndex].correctAnswer) {
        socket.emit('hideAnswerContainer')
        console.log(`Player ${player.name} answered correctly.`);
        answeredCorrectly.add(socket.id); // Mark player as answered correctly
        playerPerformance[player.name].correctAnswers++;
        const answerTime = (new Date().getTime() - questionStartTime) / 1000;
        playerTimes.set(player.name, answerTime);
        playerPerformance[player.name].totalTime += answerTime;
        playerPerformance[player.name].percent = questions[currentQuestionIndex].percent;
        updatePlayers();
    } else {
        socket.emit('hideAnswerContainer')
        console.log(`Player ${player.name} answered incorrectly.`);
        updatePlayers();
    }
    });

    socket.on('skipQuestion', () => {
        const player = players.find(p => p.id === socket.id);
        if (player && playersWithSkip.has(player.name)) {
            socket.emit('hideAnswerContainer')
            playersWithSkip.delete(player.name);
            playersWithoutSkip.add(player.name);
            console.log(`Player ${player.name} answered correctly.`);
            answeredCorrectly.add(socket.id); // Mark player as answered correctly
            const answerTime = (new Date().getTime() - questionStartTime) / 1000;
            playerTimes.set(player.name, answerTime);
            playerPerformance[player.name].totalTime += answerTime;
            playerPerformance[player.name].percent = questions[currentQuestionIndex].percent;
            updatePlayers();
        }
    });

    socket.on('revealAnswer', () => {
        if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
          const correctAnswer = questions[currentQuestionIndex].correctAnswer;
          const showAnswer = questions[currentQuestionIndex].showAnswer;
          io.emit('answerRevealed', {correctAnswer:correctAnswer,showAnswer:showAnswer});
        }
    });

    socket.on('previewNextQuestion', () => {
        if (socket.id === adminSocketId1||socket.id === adminSocketId2) {
          sendNextQuestionToAdmin();
          nextQuestionIndex++;
        }
    });

    socket.on('nextQuestion', () => {
        io.emit('clearAnswer');
        currentQuestionIndex++;
        kickedOutCount = 0; // Reset kicked out count for the next question
        sendQuestion();
    });

    socket.on('adminLogin', () => {
        if(!adminSocketId1){
            adminSocketId1 = socket.id;
        }
        else{
            adminSocketId2 = socket.id;
        }
        console.log(`Admin (${socket.id}) logged in.`);
    });

    socket.on('togglePlayerJoin', () => {
        canPlayersJoin = !canPlayersJoin;
        const status = canPlayersJoin ? 'enabled' : 'disabled';
        console.log(`Player joining ${status} by admin.`);
        io.emit('playerJoinToggle', canPlayersJoin);
    });

    socket.on('startGame', () => {
        if (socket.id === adminSocketId1 || socket.id === adminSocketId2) {
          sendQuestion();
        } else {
          console.log(`Non-admin (${socket.id}) attempted to start the game.`);
        }
    });

    socket.on('revealTop5Players',()=>{
        io.emit('revealTop5Players',getTopPlayers())
    })

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        players = players.filter(p => p.id !== socket.id);
        playersWithSkip.delete(socket.id.name);
        playersWithoutSkip.delete(socket.id.name);
        if(!canPlayersJoin){
            kickedOutCount++;
            io.emit('updateKickedOutCount', kickedOutCount); // Emit kicked out count to all cliente
        }
        updatePlayers()
        if (socket.id === adminSocketId1 || socket.id === adminSocketId2) {
            console.log('Admin disconnected.');
            adminSocketId = null;
        }
    });
});

app.use(express.static('public'));

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});