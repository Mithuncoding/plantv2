import React, { useContext, useState, useEffect } from 'react';
import { SettingsContext } from '../../context/SettingsContext';
import './ResultDisplay.css';
import MedicineSuggestions from './MedicineSuggestions';
import LanguageSelector from '../LanguageSelector/LanguageSelector';

const ResultDisplay = ({ result }) => {
  const { settings, updateSettings } = useContext(SettingsContext);
  const [translatedContent, setTranslatedContent] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const translateResults = async () => {
      if (!result || settings.language === 'en') {
        setTranslatedContent(parseAndStructureResult(result));
        return;
      }

      try {
        setIsTranslating(true);
        const structured = parseAndStructureResult(result);
        
        if (structured.qaFormat) {
          const translated = await Promise.all(
            structured.qaFormat.map(async (qa) => ({
              question: await translateContent(qa.question, settings.language),
              answer: await Promise.all(
                qa.answer.map(ans => translateContent(ans, settings.language))
              )
            }))
          );
          setTranslatedContent({ ...structured, qaFormat: translated });
        }
      } catch (error) {
        console.error('Translation error:', error);
        setTranslatedContent(parseAndStructureResult(result)); // Fallback to original content
      } finally {
        setIsTranslating(false);
      }
    };

    translateResults();
  }, [result, settings.language]);

  const translateContent = async (text, targetLanguage) => {
    if (!text || targetLanguage === 'en') return text;
    
    try {
      // First attempt: LibreTranslate
      const response = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: 'en',
          target: targetLanguage,
        })
      });
      
      if (!response.ok) {
        throw new Error('LibreTranslate failed');
      }
      
      const data = await response.json();
      return data.translatedText || text;
      
    } catch (error) {
      console.error('LibreTranslate error:', error);
      
      // Fallback: MyMemory Translation API
      try {
        const myMemoryResponse = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLanguage}`
        );
        const myMemoryData = await myMemoryResponse.json();
        return myMemoryData.responseData.translatedText || text;
      } catch (fallbackError) {
        console.error('Fallback translation error:', fallbackError);
        return text; // Return original text if all translation attempts fail
      }
    }
  };

  const parseAndStructureResult = (rawResult) => {
    if (!rawResult) return { qaFormat: [] };
    
    const sections = {
      qaFormat: []
    };

    const lines = rawResult.split('\n').map(line => line.trim()).filter(Boolean);
    let currentQA = null;

    lines.forEach(line => {
      const cleanLine = line.replace(/\*\*/g, '').trim();
      
      if (cleanLine.includes('Plant Identification:') || 
          cleanLine.includes('Disease Analysis:') || 
          cleanLine.includes('Treatment Plan:')) {
        currentQA = {
          question: cleanLine,
          answer: []
        };
        sections.qaFormat.push(currentQA);
      } 
      else if (currentQA && (cleanLine.startsWith('-') || cleanLine.startsWith('•'))) {
        const answer = cleanLine.replace(/^-|^•/, '').trim();
        if (answer) {
          currentQA.answer.push(answer);
        }
      }
    });

    return sections;
  };

  const structuredResult = translatedContent || parseAndStructureResult(result);

  const handleLanguageChange = (newLanguage) => {
    updateSettings({ ...settings, language: newLanguage });
  };

  if (!result || typeof result !== 'string') {
    return (
        <div className="error-container">
            <p>No analysis results available. Please try again.</p>
        </div>
    );
  }

  return (
    <div className="result-container">
      <div className="result-header">
        <h2>Analysis Results</h2>
        <LanguageSelector 
          selectedLanguage={settings.language}
          onLanguageChange={handleLanguageChange}
        />
      </div>

      {isTranslating ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Translating content...</p>
        </div>
      ) : (
        structuredResult.qaFormat && structuredResult.qaFormat.length > 0 && (
          <div className="qa-section">
            {structuredResult.qaFormat.map((qa, index) => (
              <div key={index} className="qa-item">
                <div className="qa-question">{qa.question}</div>
                <div className="qa-answer">
                  {qa.answer.map((answer, idx) => (
                    <p key={idx}>{answer}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default ResultDisplay;
