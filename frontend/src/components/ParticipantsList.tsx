import React from 'react';
import { Participant } from '../services/apiService';

interface ParticipantsListProps {
  participants: Participant[];
  currentParticipant: Participant;
  onRefresh: () => void;
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({ 
  participants = [], // Provide default empty array
  currentParticipant,
  onRefresh 
}) => {
  const formatJoinTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Ensure participants is always an array
  const safeParticipants = Array.isArray(participants) ? participants : [];

  return (
    <div className="participants-list">
      <div className="participants-header">
        <h3>👥 Participants ({safeParticipants.length})</h3>
        <button onClick={onRefresh} className="refresh-participants-btn">
          🔄
        </button>
      </div>
      
      <div className="participants-content">
        {safeParticipants.length === 0 ? (
          <p className="no-participants">No participants found</p>
        ) : (
          <ul className="participants-ul">
            {safeParticipants.map((participant) => (
              <li 
                key={participant.id} 
                className={`participant-item ${
                  participant.id === currentParticipant.id ? 'current-user' : ''
                }`}
              >
                <div className="participant-info">
                  <div className="participant-name">
                    {participant.name}
                    {participant.isHost && ' 👑'}
                    {participant.id === currentParticipant.id && ' (You)'}
                  </div>
                  <div className="participant-details">
                    <span className="join-time">
                      Joined: {formatJoinTime(participant.joinedAt)}
                    </span>
                  </div>
                </div>
                
                <div className="participant-status">
                  <span className="status-indicator online">🟢</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ParticipantsList;