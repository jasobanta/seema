import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css'
})
export class ReportsComponent {
constructor(
    private http: HttpClient,
    private config: ConfigService
) { }

downloadEntrustedReport() {

    this.http.get(
        this.config.apiUrl + '/downloadcsv',
        {
            responseType: 'blob'
        }
    ).subscribe(blob => {

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');

        a.href = url;

        a.download = 'Entrusted_Report.csv';

        a.click();

        URL.revokeObjectURL(url);

    });

}
downloadShapefile(): void {

    window.open(
        this.config.apiUrl + '/reports/roads/shp',
        '_blank'
    );

}

}
