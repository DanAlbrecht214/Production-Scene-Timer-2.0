document.addEventListener('DOMContentLoaded', () => {
    const checkpointsList = document.getElementById('checkpoints-list');
    const addCheckpointButton = document.getElementById('add-checkpoint');
    const loadCheckpointsOBSButton = document.getElementById('load-checkpoints-obs');
    const resetButton = document.getElementById('reset');
    const saveButton = document.getElementById('save');
    const loadButton = document.getElementById('load');
    const fileInput = document.getElementById('file-input');
    const jsonOutput = document.getElementById('json-output');
    const timeSpentElement = document.getElementById('time-spent');
    const totalTimeAllowedElement = document.getElementById('total-time-allowed');
    const timeRemainingElement = document.getElementById('time-remaining');
    const logContentElement = document.getElementById('log-content');
    const websocketPortInput = document.getElementById('websocket-port');
    const websocketPasswordInput = document.getElementById('websocket-password');
    const connectWebSocketButton = document.getElementById('connect-websocket');
    const websocketStatus = document.getElementById('websocket-status');
    const activeCheckpointContent = document.getElementById('active-checkpoint-content');
    const copyJsonButton = document.getElementById('copy-json');
    const jsonOutputTextarea = document.getElementById('json-output');
    const jsonSaveMessage = document.getElementById('json-save-message');
    const addCheckpointMessage = document.getElementById('add-checkpoint-message');
    const resetMessage = document.getElementById('reset-message');
    const clearCheckpointsButton = document.getElementById('clear-checkpoints');
    const clearCheckpointsMessage = document.getElementById('clear-checkpoints-message');

    clearCheckpointsButton.addEventListener('click', () => {
        // Clear all checkpoints
        checkpoints = [];
        checkpointsList.innerHTML = ''; // Clear the displayed checkpoints
        totalTimeSpent = 0; // Reset the total time spent
        activeCheckpointIndex = null; // Clear any active checkpoint
        updateTotalTimes(); // Update total time display
        clearActiveCheckpointHighlighting(); // Clear any active checkpoint highlighting

        // Display the message after clearing the checkpoints
        clearCheckpointsMessage.style.display = 'block';

        // Hide the message after 5 seconds
        setTimeout(() => {
            clearCheckpointsMessage.style.display = 'none';
        }, 5000); // 5000 milliseconds = 5 seconds
    });
    
    addCheckpointButton.addEventListener('click', () => {
        addCheckpoint(); // Existing add checkpoint functionality

        // Display the message after adding a checkpoint
        addCheckpointMessage.style.display = 'block';

        // Hide the message after 5 seconds
        setTimeout(() => {
            addCheckpointMessage.style.display = 'none';
        }, 5000); // 5000 milliseconds = 5 seconds
    });

    resetButton.addEventListener('click', () => {
        resetTimers(); // Existing reset functionality

        // Display the message after resetting
        resetMessage.style.display = 'block';

        // Hide the message after 5 seconds
        setTimeout(() => {
            resetMessage.style.display = 'none';
        }, 5000); // 5000 milliseconds = 5 seconds
    });

    loadButton.addEventListener('click', () => {
        loadCheckpoints(); // Existing load functionality

        // Display the message after loading the JSON file
        loadMessage.style.display = 'block';

        // Hide the message after 5 seconds
        setTimeout(() => {
            loadMessage.style.display = 'none';
        }, 5000); // 5000 milliseconds = 5 seconds
    });
    
    saveButton.addEventListener('click', () => {
        saveCheckpoints(); // Existing save functionality

        // Display the message after saving
        jsonSaveMessage.style.display = 'block';

        // Optional: Automatically scroll to the JSON Output section
        document.getElementById('json-output-section').scrollIntoView({ behavior: 'smooth' });

        // Hide the message after 10 seconds
        setTimeout(() => {
            jsonSaveMessage.style.display = 'none';
        }, 5000); // 10000 milliseconds = 10 seconds
    });

    const loadMessage = document.getElementById('load-message');

    loadCheckpointsOBSButton.addEventListener('click', () => {
        loadCheckpointsFromOBS(); // Existing load functionality

        // Display the message after loading
        loadMessage.style.display = 'block';

        // Hide the message after 5 seconds
        setTimeout(() => {
            loadMessage.style.display = 'none';
        }, 5000); // 5000 milliseconds = 5 seconds
    });


    copyJsonButton.addEventListener('click', () => {
        jsonOutputTextarea.select(); // Select the text in the textarea
        document.execCommand('copy'); // Copy the selected text to the clipboard
        alert('JSON copied to clipboard!'); // Optional: Display a confirmation message
    });

    let checkpoints = [];
    let overallTimerInterval = null;
    let totalTimeSpent = 0;
    let totalDuration = 0;
    let log = [];
    let logIndex = 0;

    // OBS WebSocket variables
    let obsWebSocket;
    let isAuthenticated = false; // To track authentication status
    let activeCheckpointIndex = null; // Track the currently active checkpoint index

    // Collapsible sections
    document.querySelectorAll('.collapsible').forEach(collapsible => {
        collapsible.addEventListener('click', function() {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            if (content.style.display === 'block') {
                content.style.display = 'none';
            } else {
                content.style.display = 'block';
            }
        });
    });

    // Connect to OBS WebSocket
    function connectOBSWebSocket() {
        const port = websocketPortInput.value || '4455'; // Default to 4455
        const password = websocketPasswordInput.value || '';
        const obsWebSocketAddress = `ws://localhost:${port}`; // Use specified port

        console.log('Attempting to connect to OBS WebSocket...');
        websocketStatus.textContent = 'Status: Connecting...';
        obsWebSocket = new WebSocket(obsWebSocketAddress);

        obsWebSocket.onopen = () => {
            console.log('Connected to OBS WebSocket');
            websocketStatus.textContent = 'Status: Connected';
            websocketStatus.classList.remove('disconnected');
            websocketStatus.classList.add('connected');
            identifyWithOBS(password);
        };

        obsWebSocket.onclose = (event) => {
            console.log('Disconnected from OBS WebSocket:', event);
            websocketStatus.textContent = 'Status: Disconnected';
            websocketStatus.classList.remove('connected');
            websocketStatus.classList.add('disconnected');
        };

        obsWebSocket.onmessage = (message) => {
            const data = JSON.parse(message.data);
            console.log('OBS WebSocket message received:', data); // Debugging log

            if (data.op === 0) {
                if (data.d.authentication) {
                    console.log('Authenticated with OBS WebSocket');
                    isAuthenticated = true;
                    subscribeToEvents();
                } else {
                    console.log('Identification success');
                    subscribeToEvents();
                }
            } else if (data.op === 5) {
                handleOBSEvent(data.d);
            } else if (data.op === 2) {
                console.log('Subscription confirmation:', data);
            } else {
                console.log('Unhandled message:', data);
            }
        };

        obsWebSocket.onerror = (error) => {
            console.error('OBS WebSocket error:', error);
            websocketStatus.textContent = 'Status: Error';
            websocketStatus.classList.remove('connected');
            websocketStatus.classList.add('disconnected');
        };
    }

    function identifyWithOBS(password) {
        console.log('Identifying with OBS WebSocket...');
        const identifyRequest = {
            'op': 1,
            'd': {
                'rpcVersion': 1
            }
        };

        if (password) {
            identifyRequest.d.authentication = btoa(password);
        }

        obsWebSocket.send(JSON.stringify(identifyRequest));
    }

    function subscribeToEvents() {
        if (!isAuthenticated) return;
        console.log('Subscribing to OBS WebSocket events...');
        const subscriptionRequest = {
            'op': 5,
            'd': {
                'eventSubscriptions': 1 // Subscribe to all events
            }
        };
        obsWebSocket.send(JSON.stringify(subscriptionRequest));
    }

    function handleOBSEvent(eventData) {
        console.log('OBS event received:', eventData); // Log event data for debugging
        if (eventData.eventType === 'CurrentProgramSceneChanged') {
            console.log('CurrentProgramSceneChanged event data:', eventData);
            handleSceneChange(eventData.eventData);
        }
    }

    function handleSceneChange(data) {
        console.log('Full scene change event data:', data); // Log full event data
        const newSceneName = data.sceneName; // This might need adjustment based on actual data structure
        console.log('Scene changed to:', newSceneName);

        if (!newSceneName) {
            console.error('Scene name is undefined. Event data:', data);
            return;
        }

        // Stop all active timers
        if (activeCheckpointIndex !== null) {
            clearInterval(checkpoints[activeCheckpointIndex].interval);
            checkpoints[activeCheckpointIndex].interval = null;
        }

        // Find checkpoint with matching name and start its timer from the remaining time
        checkpoints.forEach((checkpoint, index) => {
            console.log(`Checking checkpoint ${checkpoint.name} against scene ${newSceneName}`);
            if (checkpoint.name === newSceneName) {
                console.log(`Resuming timer for checkpoint: ${checkpoint.name}`);
                startCheckpointTimer(index, true);
            }
        });
    }

    function addCheckpoint(name = '', duration = '00:00:00', autoStartNext = false) {
        const checkpointIndex = checkpoints.length;

        const checkpoint = document.createElement('div');
        checkpoint.className = 'checkpoint';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Checkpoint name';
        input.className = 'checkpoint-name';
        input.value = name;

        const durationInput = document.createElement('input');
        durationInput.type = 'text';
        durationInput.placeholder = 'hh:mm:ss';
        durationInput.className = 'duration';
        durationInput.value = duration;
        durationInput.addEventListener('change', () => {
            updateCheckpointDuration(checkpointIndex);
            updateTotalTimes();
        });

        const remainingLabel = document.createElement('label');
        remainingLabel.textContent = 'Time Remaining: ';

        const remaining = document.createElement('span');
        remaining.className = 'remaining';
        remaining.textContent = '00:00:00';

        remainingLabel.appendChild(remaining);

        const startButton = document.createElement('button');
        startButton.textContent = 'Start';
        startButton.addEventListener('click', () => startCheckpointTimer(checkpointIndex));

        const finishButton = document.createElement('button');
        finishButton.textContent = 'Finish';
        finishButton.addEventListener('click', () => finishCheckpoint(checkpointIndex));

        const autoStartLabel = document.createElement('label');
        autoStartLabel.className = 'checkbox-label';
        const autoStartCheckbox = document.createElement('input');
        autoStartCheckbox.type = 'checkbox';
        autoStartCheckbox.checked = autoStartNext;
        autoStartCheckbox.className = 'auto-start-next';
        autoStartLabel.appendChild(autoStartCheckbox);
        autoStartLabel.appendChild(document.createTextNode('Auto-start next'));

        const actions = document.createElement('div');
        actions.className = 'checkpoint-actions';
        actions.appendChild(startButton);
        actions.appendChild(finishButton);
        actions.appendChild(autoStartLabel);

        checkpoint.appendChild(input);
        checkpoint.appendChild(durationInput);
        checkpoint.appendChild(remainingLabel);
        checkpoint.appendChild(actions);
        checkpointsList.appendChild(checkpoint);

        checkpoints.push({
            name: name,
            duration: parseDuration(duration),
            remaining: parseDuration(duration),
            autoStartNext: autoStartNext,
            interval: null,
            active: false,
            overTime: 0
        });
    }

    function updateCheckpointDuration(index) {
        checkpoints[index].duration = parseDuration(document.querySelectorAll('.duration')[index].value);
        checkpoints[index].remaining = checkpoints[index].duration;
        updateCheckpointDisplay(index); // Update display to reflect new duration
    }

    function startCheckpointTimer(index, resume = false) {
        const checkpoint = checkpoints[index];
        if (!resume) {
            checkpoint.duration = parseDuration(document.querySelectorAll('.duration')[index].value);
            checkpoint.remaining = checkpoint.duration;
        }

        if (checkpoint.interval) clearInterval(checkpoint.interval);

        checkpoint.active = true;
        highlightActiveCheckpoint(index);
        activeCheckpointIndex = index;

        checkpoint.interval = setInterval(() => {
            if (checkpoint.remaining > 0) {
                checkpoint.remaining -= 1;
            } else if (checkpoint.remaining === 0 && checkpoint.autoStartNext && index + 1 < checkpoints.length) {
                clearInterval(checkpoint.interval);
                startCheckpointTimer(index + 1);
            } else {
                checkpoint.overTime += 1;
            }
            updateCheckpointDisplay(index);
            updateTotalTimes();
        }, 1000);

        logIndex++;
        log.push(`Log ${logIndex}`);
        logCheckpoint(index);

        if (!overallTimerInterval) {
            overallTimerInterval = setInterval(() => {
                totalTimeSpent += 1;
                updateTotalTimes();
            }, 1000);
        }
    }

    function finishCheckpoint(index) {
        const checkpoint = checkpoints[index];
        console.log('Finishing checkpoint:', index, 'Current remaining:', checkpoint.remaining);
    
        if (checkpoint.interval) {
            clearInterval(checkpoint.interval);
            checkpoint.interval = null;
            console.log('Timer stopped for checkpoint:', index);
        }
    
        checkpoint.active = false;
        checkpoint.remaining = checkpoint.duration; // Reset remaining time to the original duration
        checkpoint.overTime = 0; // Reset overtime to 0
        activeCheckpointIndex = null; // Clear active checkpoint index
        
        stopAllTimers(); // Ensure all timers are stopped
        clearActiveCheckpointHighlighting(); // Clear pulsing and highlighting
    
        updateCheckpointDisplay(index); // Update display to reflect reset state
        updateTotalTimes();
    }
    
    
    
    function resetTimers() {
        console.log('Resetting all timers...');
        stopAllTimers(); // Stop any running timers
        checkpoints.forEach((checkpoint, index) => {
            console.log('Resetting checkpoint:', index, 'Original duration:', checkpoint.duration);
            checkpoint.remaining = checkpoint.duration; // Reset remaining time to original duration
            checkpoint.overTime = 0; // Reset overtime
            checkpoint.active = false; // Mark as inactive
            updateCheckpointDisplay(index); // Update display
        });
        totalTimeSpent = 0;
        activeCheckpointIndex = null; // Clear active checkpoint index
        updateTotalTimes(); // Update total time display
        logTotalTimes(); // Log the reset state
        clearActiveCheckpointHighlighting(); // Clear any active checkpoint highlighting
    }
    

    function stopAllTimers() {
        console.log('Stopping all active timers...');
        checkpoints.forEach((checkpoint, index) => {
            if (checkpoint.interval) {
                clearInterval(checkpoint.interval);
                checkpoint.interval = null;
                console.log('Timer stopped for checkpoint:', index);
            }
            checkpoint.active = false; // Ensure checkpoints are marked as inactive
            updateCheckpointDisplay(index); // Update the display to remove pulsing effects
        });
    
        if (overallTimerInterval) {
            clearInterval(overallTimerInterval);
            overallTimerInterval = null;
            console.log('Overall timer stopped.');
        }
    }
    
    function clearActiveCheckpointHighlighting() {
        checkpoints.forEach((checkpoint, index) => {
            const checkpointElement = checkpointsList.children[index];
            checkpointElement.classList.remove('active', 'pulse', 'over-time', 'warning');
        });
        activeCheckpointContent.innerHTML = ''; // Clear the active checkpoint content
    }
    
    

    function parseDuration(duration) {
        const parts = duration.split(':').map(part => parseInt(part, 10));
        let seconds = 0;
        if (parts.length === 3) {
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            seconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 1) {
            seconds = parts[0];
        }
        return seconds;
    }

    function highlightActiveCheckpoint(activeIndex) {
        checkpoints.forEach((checkpoint, index) => {
            const checkpointElement = checkpointsList.children[index];
            if (index === activeIndex) {
                checkpointElement.classList.add('active');
                displayActiveCheckpoint(checkpoint, checkpointElement);
            } else {
                checkpointElement.classList.remove('active');
            }
        });
    }

    function displayActiveCheckpoint(checkpoint, checkpointElement) {
        activeCheckpointContent.innerHTML = ''; // Clear previous content
        const clonedCheckpoint = checkpointElement.cloneNode(true);
        const totalTimeAllowedClone = totalTimeAllowedElement.cloneNode(true);
        const timeSpentClone = timeSpentElement.cloneNode(true);
        const timeRemainingClone = timeRemainingElement.cloneNode(true);
    
        const totalTimeAllowedLabel = document.createElement('p');
        totalTimeAllowedLabel.textContent = 'Total Time Allowed: ';
        totalTimeAllowedLabel.appendChild(totalTimeAllowedClone);
    
        const timeSpentLabel = document.createElement('p');
        timeSpentLabel.textContent = 'Total Time Spent: ';
        timeSpentLabel.appendChild(timeSpentClone);
    
        const timeRemainingLabel = document.createElement('p');
        timeRemainingLabel.textContent = 'Total Time Remaining: ';
        timeRemainingLabel.appendChild(timeRemainingClone);
    
        clonedCheckpoint.appendChild(totalTimeAllowedLabel);
        clonedCheckpoint.appendChild(timeSpentLabel);
        clonedCheckpoint.appendChild(timeRemainingLabel);
    
        // Remove the Start button
        const startButton = clonedCheckpoint.querySelector('.checkpoint-actions button:nth-child(1)');
        if (startButton) {
            startButton.remove(); // Remove the Start button from the active checkpoint
        }
    
        // Ensure the Finish button is correctly wired up
        const finishButton = clonedCheckpoint.querySelector('.checkpoint-actions button:nth-child(1)');
        if (finishButton) {
            finishButton.addEventListener('click', () => {
                finishCheckpoint(checkpoints.indexOf(checkpoint));
            });
        }
    
        activeCheckpointContent.appendChild(clonedCheckpoint);
    }
    
    
    function updateCheckpointColor(element, remainingTime, isActive) {
        const checkpointElement = element.parentElement.parentElement;
    
        console.log('Remaining Time:', remainingTime, 'Is Active:', isActive); // Debugging log
    
        if (isActive) {
            if (remainingTime < 0) {
                console.log('Checkpoint is overtime and should pulse red');
                // The checkpoint is over time and should pulse red
                element.style.color = 'red';
                checkpointElement.classList.add('over-time');
                checkpointElement.classList.remove('warning');
                checkpointElement.classList.add('pulse'); // Red pulsing effect
            } else if (remainingTime < 30) {
                console.log('Checkpoint is in last 30 seconds and should pulse yellow');
                // The checkpoint is within the last 30 seconds and should pulse yellow
                element.style.color = 'yellow';
                checkpointElement.classList.add('warning');
                checkpointElement.classList.add('pulse'); // Yellow pulsing effect
                checkpointElement.classList.remove('over-time');
            } else {
                console.log('Checkpoint is within time, no pulsing effect');
                // Normal countdown without pulsing
                element.style.color = 'green';
                checkpointElement.classList.remove('over-time');
                checkpointElement.classList.remove('warning');
                checkpointElement.classList.remove('pulse');
            }
        } else {
            console.log('Checkpoint is not active, no pulsing should apply');
            // Ensure that if not active, no pulsing is applied
            element.style.color = remainingTime < 0 ? 'red' : 'green';
            checkpointElement.classList.remove('over-time');
            checkpointElement.classList.remove('warning');
            checkpointElement.classList.remove('pulse');
        }
    }
    
    function updateCheckpointDisplay(index) {
        const checkpointElement = checkpointsList.children[index];
        const remainingElement = checkpointElement.querySelector('.remaining');
        const remainingTime = checkpoints[index].remaining;
        const overTime = checkpoints[index].overTime;
        const isActive = checkpoints[index].active;
    
        if (remainingTime < 0) {
            remainingElement.textContent = `Overtime: ${formatTime(Math.abs(overTime))}`;
        } else {
            remainingElement.textContent = formatTime(remainingTime);
        }
    
        updateCheckpointColor(remainingElement, remainingTime, isActive);
    }
    
    
    
    function startCheckpointTimer(index, resume = false) {
        const checkpoint = checkpoints[index];
        if (!resume) {
            checkpoint.duration = parseDuration(document.querySelectorAll('.duration')[index].value);
            checkpoint.remaining = checkpoint.duration;
        }
    
        if (checkpoint.interval) clearInterval(checkpoint.interval);
    
        checkpoint.active = true;
        highlightActiveCheckpoint(index);
        activeCheckpointIndex = index;
    
        checkpoint.interval = setInterval(() => {
            if (checkpoint.remaining > 0) {
                checkpoint.remaining -= 1;
            } else if (checkpoint.remaining <= 0) {
                checkpoint.remaining -= 1; // Continue counting into negative time
                checkpoint.overTime += 1;  // Increment overtime
    
                if (checkpoint.remaining === 0 && checkpoint.autoStartNext && index + 1 < checkpoints.length) {
                    clearInterval(checkpoint.interval);
                    startCheckpointTimer(index + 1);
                }
            }
    
            updateCheckpointDisplay(index);
            updateTotalTimes();
        }, 1000);
    
        logIndex++;
        log.push(`Log ${logIndex}`);
        logCheckpoint(index);
    
        if (!overallTimerInterval) {
            overallTimerInterval = setInterval(() => {
                totalTimeSpent += 1;
                updateTotalTimes();
            }, 1000);
        }
    }
    
    function updateTotalTimes() {
        totalDuration = checkpoints.reduce((acc, cp) => acc + cp.duration, 0);
        const totalTimeRemaining = totalDuration - totalTimeSpent;

        totalTimeAllowedElement.textContent = formatTime(totalDuration);
        timeSpentElement.textContent = formatTime(totalTimeSpent);
        timeRemainingElement.textContent = formatTime(totalTimeRemaining >= 0 ? totalTimeRemaining : -totalTimeRemaining);

        if (activeCheckpointIndex !== null) {
            displayActiveCheckpoint(checkpoints[activeCheckpointIndex], checkpointsList.children[activeCheckpointIndex]);
        }
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function logCheckpoint(index) {
        const checkpoint = checkpoints[index];
        const name = document.querySelectorAll('.checkpoint-name')[index].value;
        const scheduledDuration = document.querySelectorAll('.duration')[index].value;
        const timeRemaining = formatTime(checkpoint.remaining);
        log.push(`Checkpoint: ${name}, Scheduled Duration: ${scheduledDuration}, Time Remaining: ${timeRemaining}`);
        updateLog();
    }

    function logTotalTimes() {
        log.push(`Total Time Allowed: ${totalTimeAllowedElement.textContent}`);
        log.push(`Total Time Spent: ${timeSpentElement.textContent}`);
        log.push(`Total Time Remaining: ${timeRemainingElement.textContent}`);
        updateLog();
    }

    function updateLog() {
        logContentElement.textContent = log.join('\n');
    }

    function saveCheckpoints() {
        const checkpointsToSave = checkpoints.map((checkpoint, index) => ({
            name: document.querySelectorAll('.checkpoint-name')[index].value,
            duration: document.querySelectorAll('.duration')[index].value,
            remaining: checkpoint.remaining,
            autoStartNext: document.querySelectorAll('.auto-start-next')[index].checked,
            overTime: checkpoint.overTime
        }));
        const dataStr = JSON.stringify(checkpointsToSave, null, 2); // Pretty-print JSON for readability

        console.log('Generated JSON Data:', dataStr); // Log JSON data for debugging

        jsonOutput.value = dataStr; // Set the JSON data to the textarea for manual copying
        jsonOutput.parentElement.style.display = 'block'; // Show the collapsible section
    }

    function loadCheckpoints() {
        fileInput.click();
    }

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const loadedCheckpoints = JSON.parse(e.target.result);
            checkpointsList.innerHTML = '';
            checkpoints = [];
            loadedCheckpoints.forEach(cp => {
                addCheckpoint(cp.name, cp.duration, cp.autoStartNext);
                const index = checkpoints.length - 1;
                checkpoints[index].name = cp.name;
                checkpoints[index].duration = parseDuration(cp.duration);
                checkpoints[index].remaining = checkpoints[index].duration; // Reset remaining to duration on load
                checkpoints[index].autoStartNext = cp.autoStartNext;
                checkpoints[index].overTime = 0; // Reset overtime on load
                updateCheckpointDisplay(index);
            });
            updateTotalTimes(); // Ensure total times are updated after loading checkpoints
        };
        reader.readAsText(file);
    });

    function loadCheckpointsFromOBS() {
        if (!obsWebSocket || obsWebSocket.readyState !== WebSocket.OPEN) {
            console.error('OBS WebSocket is not connected');
            return;
        }

        const request = {
            'op': 6, // Request type for OBS WebSocket
            'd': {
                'requestType': 'GetSceneList',
                'requestId': 'getSceneList'
            }
        };

        obsWebSocket.send(JSON.stringify(request));

        obsWebSocket.onmessage = (message) => {
            const data = JSON.parse(message.data);
            console.log('OBS WebSocket GetSceneList response:', data); // Debugging log

            if (data.d && data.d.requestType === 'GetSceneList') {
                const scenes = data.d.responseData.scenes.reverse(); // Reverse scenes to correct order
                console.log('Scenes from OBS:', scenes); // Debugging log

                // Clear existing checkpoints
                checkpointsList.innerHTML = '';
                checkpoints = [];

                scenes.forEach(scene => {
                    addCheckpoint(scene.sceneName, '00:00:00', false);
                });

                updateTotalTimes(); // Ensure total times are updated after loading checkpoints
            }
        };
    }

    addCheckpointButton.addEventListener('click', addCheckpoint);
    loadCheckpointsOBSButton.addEventListener('click', loadCheckpointsFromOBS);
    resetButton.addEventListener('click', resetTimers);
    saveButton.addEventListener('click', saveCheckpoints);
    loadButton.addEventListener('click', loadCheckpoints);
    connectWebSocketButton.addEventListener('click', connectOBSWebSocket); // Add listener for new connect button
});
