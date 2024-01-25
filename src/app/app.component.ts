import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { fromEvent } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  #http = inject(HttpClient);
  #destroyRef = inject(DestroyRef);

  mediaRecorder?: MediaRecorder;
  audioChunks: Blob[] = [];
  downloadLink = signal<string>('');
  convertedMessage = signal<string>('');
  status = signal<string>('STOPPED');

  constructor() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.mediaRecorder = new MediaRecorder(stream);
        this.init();
      })
      .catch(err => {
        console.error("Error accessing the microphone: ", err);
      });
  }

  init(): void {
    if (this.mediaRecorder) {
      console.log('initialized');
      fromEvent<BlobEvent>(this.mediaRecorder, 'dataavailable')
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe((event: BlobEvent) => {
          this.audioChunks.push(event.data);
        });
      fromEvent(this.mediaRecorder, 'stop')
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe(() => {
          console.log('Stopped recording');
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
          const audioUrl = URL.createObjectURL(audioBlob);
          this.downloadLink.set(audioUrl);
          this.uploadAudio();
        });
    }
  }

  startRecording() {
    if (this.mediaRecorder) {
      this.mediaRecorder.start();
      this.status.set('RECORDING');
    }
  }

  stopRecording() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.audioChunks = [];
      this.status.set('STOPPED');
    }
  }

  uploadAudio() {
    if (!this.downloadLink) {
      console.error("No audio data available to upload.");
      return;
    }
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recorded-audio.webm');
    this.#http.post<string>('http://localhost:5076/upload?lang=en-US', formData)
      .subscribe({
        next: (res) => {
          console.log('Upload successful', res);
          this.convertedMessage.set(res);
        },
        error: (err) => {
          console.error('Upload error:', err);
          this.convertedMessage.set('Upload error: ' + err);
        },
        complete: () => console.info('Request completed')
      });
  }
}
