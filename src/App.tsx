/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  Send, 
  FileText, 
  BrainCircuit, 
  Sparkles, 
  HelpCircle, 
  Table as TableIcon,
  ChevronRight,
  Upload,
  User,
  Bot,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { StudyTutorService } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker using a more reliable CDN link for version 5.5.207
// We use the .mjs version for modern browsers and compatibility with v5+
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.5.207/build/pdf.worker.min.mjs';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: '¡Hola! Soy tu tutor de estudio personal. Estoy aquí para ayudarte a comprender cualquier tema. ¿Qué vamos a estudiar hoy? Puedes subir un documento o simplemente pegarme el texto aquí.' }
  ]);
  const [input, setInput] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const tutorService = useRef<StudyTutorService | null>(null);

  useEffect(() => {
    tutorService.current = new StudyTutorService();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const response = await tutorService.current?.chat(text, documentText, history);
      
      if (response) {
        setMessages(prev => [...prev, { role: 'model', content: response }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { role: 'model', content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    console.log('Iniciando extracción de PDF:', file.name);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: true,
        isEvalSupported: false,
      });
      
      const pdf = await loadingTask.promise;
      console.log(`PDF cargado: ${pdf.numPages} páginas`);
      
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`Procesando página ${i}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      const trimmedText = fullText.trim();
      console.log('Extracción completada. Longitud del texto:', trimmedText.length);
      
      if (!trimmedText || trimmedText.length < 10) {
        throw new Error('No se pudo extraer texto del PDF. Esto suele ocurrir si el PDF es una imagen escaneada sin capa de texto. Por favor, intenta con un PDF que tenga texto seleccionable o un archivo .txt.');
      }
      
      return trimmedText;
    } catch (error: any) {
      console.error('Error detallado en extractTextFromPDF:', error);
      throw new Error(`Error al leer el PDF: ${error.message || 'Error desconocido'}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('Archivo seleccionado:', file.name, 'Tipo:', file.type, 'Tamaño:', file.size);

    // Check file size (limit to 5MB for safety)
    if (file.size > 5 * 1024 * 1024) {
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: `⚠️ El archivo "${file.name}" es demasiado grande (máximo 5MB). Por favor, intenta con un documento más pequeño o divídelo en partes.` 
      }]);
      return;
    }

    setIsUploading(true);
    try {
      let text = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractTextFromPDF(file);
      } else {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsText(file);
        });
      }

      if (!text || !text.trim()) {
        throw new Error('El documento parece estar vacío o no contiene texto extraíble.');
      }

      setDocumentText(text);
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: `¡Documento cargado con éxito! He analizado "${file.name}". ¿En qué puedo ayudarte con este material? Puedo resumirlo, explicarte conceptos o hacerte un quiz.` 
      }]);
    } catch (error: any) {
      console.error('Error en handleFileUpload:', error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: `❌ Error al procesar el archivo: ${error.message || 'Asegúrate de que sea un PDF o TXT válido.'}` 
      }]);
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be uploaded again if needed
      e.target.value = '';
    }
  };

  const quickActions = [
    { label: 'Resumir en 5 puntos', icon: FileText, prompt: 'Resume este capítulo en 5 puntos clave' },
    { label: 'Explicar a un niño', icon: Sparkles, prompt: 'Explícame como si tuviera 10 años este tema' },
    { label: 'Crear un Quiz', icon: HelpCircle, prompt: 'Crea un quiz de 5 preguntas sobre el tema' },
    { label: 'Tabla Comparativa', icon: TableIcon, prompt: 'Genera una tabla comparativa de los conceptos principales' },
  ];

  return (
    <div className="flex h-screen bg-brand-50 text-brand-900">
      {/* Sidebar */}
      <aside className="w-80 border-r border-brand-200 bg-white flex flex-col hidden md:flex">
        <div className="p-6 border-bottom border-brand-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-brand-500 rounded-lg text-white">
              <BookOpen size={24} />
            </div>
            <h1 className="text-xl font-serif font-bold">Tutor IA</h1>
          </div>
          <p className="text-sm text-brand-500 italic">Tu compañero de estudio paciente y experto.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-500 mb-3 px-2">Documento de Estudio</h2>
            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-brand-200 rounded-2xl cursor-pointer hover:bg-brand-50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-brand-500 mb-2" />
                      <p className="text-xs text-brand-500">Subir archivo (.pdf, .txt)</p>
                    </>
                  )}
                </div>
                <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} />
              </label>
              
              {documentText && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-500" size={16} />
                  <span className="text-xs font-medium text-emerald-700">Material cargado</span>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-500 mb-3 px-2">Acciones Rápidas</h2>
            <div className="grid grid-cols-1 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSendMessage(action.prompt)}
                  disabled={isLoading}
                  className="flex items-center gap-3 p-3 text-left text-sm font-medium rounded-xl hover:bg-brand-100 transition-colors group"
                >
                  <action.icon size={18} className="text-brand-500 group-hover:scale-110 transition-transform" />
                  <span>{action.label}</span>
                  <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-brand-100">
          <div className="bg-brand-50 p-4 rounded-2xl flex items-start gap-3">
            <BrainCircuit className="text-brand-500 shrink-0" size={20} />
            <div>
              <p className="text-xs font-semibold mb-1">Consejo del Tutor</p>
              <p className="text-[10px] text-brand-600 leading-relaxed italic">
                "La repetición espaciada y explicar conceptos en tus propias palabras son las mejores formas de aprender."
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Header Mobile */}
        <header className="md:hidden p-4 border-b border-brand-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="text-brand-500" size={20} />
            <h1 className="font-serif font-bold">Tutor IA</h1>
          </div>
          <label className="p-2 hover:bg-brand-50 rounded-full cursor-pointer">
            <Upload size={20} className="text-brand-500" />
            <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} />
          </label>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4",
                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    message.role === 'user' ? "bg-brand-900 text-white" : "bg-brand-500 text-white"
                  )}>
                    {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-2xl shadow-sm",
                    message.role === 'user' 
                      ? "bg-brand-900 text-white rounded-tr-none" 
                      : "bg-white border border-brand-100 rounded-tl-none"
                  )}>
                    <div className={cn(
                      "markdown-body",
                      message.role === 'user' ? "text-white prose-invert" : ""
                    )}>
                      <Markdown>{message.content}</Markdown>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <div className="bg-white border border-brand-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-brand-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-brand-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-brand-300 rounded-full animate-bounce"></span>
                  </div>
                  <span className="text-xs text-brand-400 font-medium">El tutor está pensando...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-8 bg-gradient-to-t from-brand-50 via-brand-50 to-transparent">
          <div className="max-w-3xl mx-auto">
            <div className="relative group">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Pregúntame cualquier cosa o pega un texto..."
                className="w-full bg-white border border-brand-200 rounded-2xl p-4 pr-14 shadow-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none min-h-[60px] max-h-[200px]"
                rows={1}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 bottom-3 p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:hover:bg-brand-500 transition-all shadow-md"
              >
                <Send size={20} />
              </button>
            </div>
            <p className="text-[10px] text-center text-brand-400 mt-3">
              Usa Shift + Enter para una nueva línea. El tutor IA puede cometer errores, verifica la información importante.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
