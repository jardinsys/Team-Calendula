// System Setup Page
// Initial setup for new users to create their system

const { useState } = require('react');
const { useNavigate } = require('react-router-dom');
const { useMutation } = require('@tanstack/react-query');
const { useAuth } = require('../context/AuthContext');
const api = require('../api/client');

function SystemSetup() {

    const navigate = useNavigate();
    const { updateSystem, refreshAuth } = useAuth();
    
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        userType: null, // 'system', 'fractured', 'basic'
    });
    
    const createSystemMutation = useMutation({
        mutationFn: async (data) => {
            // Create the system
            const system = await api.createSystem({
                name: data.name,
                description: data.description,
                sys_type: {
                    isSystem: data.userType === 'system',
                    isFragmented: data.userType === 'fractured',
                    name: data.userType === 'system' ? 'System' : 
                          data.userType === 'fractured' ? 'Fractured' : 'Basic'
                }
            });
            return system;
        },
        onSuccess: (system) => {
            updateSystem(system);
            navigate('/app');
        }
    });
    
    const handleNext = () => {
        setStep(step + 1);
    };
    
    const handleBack = () => {
        setStep(step - 1);
    };
    
    const handleSubmit = () => {
        createSystemMutation.mutate(formData);
    };
    
    const selectUserType = (type) => {
        setFormData({ ...formData, userType: type });
        handleNext();
    };
    
    return (
        <div className="setup-page">
            <div className="setup-container">
                {/* Progress Indicator */}
                <div className="progress-bar">
                    <div 
                        className="progress-fill" 
                        style={{ width: `${(step / 3) * 100}%` }}
                    />
                </div>
                <div className="step-indicator">Step {step} of 3</div>
                
                {/* Step 1: Choose User Type */}
                {step === 1 && (
                    <div className="setup-step">
                        <h1>How would you like to use Systemiser?</h1>
                        <p className="step-description">
                            This determines which features you'll have access to. 
                            You can change this later in settings.
                        </p>
                        
                        <div className="user-type-options">
                            <button 
                                className="type-option"
                                onClick={() => selectUserType('system')}
                            >
                                <span className="type-icon">🎭</span>
                                <h3>I'm a System</h3>
                                <p>
                                    Full access to alters, states, groups, 
                                    front tracking, and all features.
                                </p>
                                <ul className="type-features">
                                    <li>✓ Alter management</li>
                                    <li>✓ States & groups</li>
                                    <li>✓ Front tracking & history</li>
                                    <li>✓ Proxy support (Discord)</li>
                                </ul>
                            </button>
                            
                            <button 
                                className="type-option"
                                onClick={() => selectUserType('fractured')}
                            >
                                <span className="type-icon">🔀</span>
                                <h3>I'm Fractured</h3>
                                <p>
                                    Access to states and groups without 
                                    full alter management.
                                </p>
                                <ul className="type-features">
                                    <li>✓ States for different moods/modes</li>
                                    <li>✓ Groups for organization</li>
                                    <li>✓ Front tracking</li>
                                    <li>✗ No alter management</li>
                                </ul>
                            </button>
                            
                            <button 
                                className="type-option"
                                onClick={() => selectUserType('basic')}
                            >
                                <span className="type-icon">📝</span>
                                <h3>Just Notes & Friends</h3>
                                <p>
                                    Basic note-taking and ability to 
                                    view friends' fronts.
                                </p>
                                <ul className="type-features">
                                    <li>✓ Notes & journaling</li>
                                    <li>✓ View friends' fronts</li>
                                    <li>✗ No entity management</li>
                                    <li>✗ No front tracking</li>
                                </ul>
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Step 2: System Name */}
                {step === 2 && (
                    <div className="setup-step">
                        <h1>What should we call your {formData.userType === 'system' ? 'system' : 'profile'}?</h1>
                        <p className="step-description">
                            This is how you'll be identified. You can change this anytime.
                        </p>
                        
                        <div className="form-group">
                            <label htmlFor="name">Name</label>
                            <input
                                id="name"
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder={formData.userType === 'system' ? 'My System' : 'My Profile'}
                                className="text-input"
                                autoFocus
                            />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="description">Description (optional)</label>
                            <textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="A short description..."
                                className="text-input"
                                rows={3}
                            />
                        </div>
                        
                        <div className="step-actions">
                            <button className="btn btn-secondary" onClick={handleBack}>
                                Back
                            </button>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleNext}
                                disabled={!formData.name.trim()}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Step 3: Confirmation */}
                {step === 3 && (
                    <div className="setup-step">
                        <h1>Ready to go! 🎉</h1>
                        <p className="step-description">
                            Here's a summary of your setup:
                        </p>
                        
                        <div className="summary-card">
                            <div className="summary-item">
                                <span className="label">Type:</span>
                                <span className="value">
                                    {formData.userType === 'system' ? '🎭 System' : 
                                     formData.userType === 'fractured' ? '🔀 Fractured' : '📝 Basic'}
                                </span>
                            </div>
                            <div className="summary-item">
                                <span className="label">Name:</span>
                                <span className="value">{formData.name}</span>
                            </div>
                            {formData.description && (
                                <div className="summary-item">
                                    <span className="label">Description:</span>
                                    <span className="value">{formData.description}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="step-actions">
                            <button className="btn btn-secondary" onClick={handleBack}>
                                Back
                            </button>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleSubmit}
                                disabled={createSystemMutation.isPending}
                            >
                                {createSystemMutation.isPending ? 'Creating...' : 'Create & Start'}
                            </button>
                        </div>
                        
                        {createSystemMutation.isError && (
                            <div className="error-message">
                                Failed to create system: {createSystemMutation.error.message}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

module.exports = SystemSetup;