import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { info, regions, provinceToRegion, regionColors } from './data';

export default function App() {
  const mapRef            = useRef(null);
  const mapInstanceRef    = useRef(null);
  const activeLayerRef    = useRef(null);
  const allLayersRef      = useRef([]);
  const modeRef           = useRef('province');

  const [mode, setMode]   = useState('province');
  const [panel, setPanel] = useState({
    title  : 'Chọn một tỉnh thành',
    region : '',
    info   : 'Nhấp vào bất kỳ tỉnh/thành nào trên bản đồ để xem thông tin.',
  });

  // ---------- Style ----------
  const fillColor = (layer, m) => {
    if (m === 'province') return '#a8d5ba';
    const rname = provinceToRegion[layer?._provinceName];
    return regionColors[rname] || '#cccccc';
  };
  const defaultStyle = (layer, m) => ({
    color: '#ffffff', weight: 1.2,
    fillColor: fillColor(layer, m), fillOpacity: 0.85,
  });
  const hoverStyle = () => ({ color: '#333', weight: 2.5, fillOpacity: 0.95 });
  const activeStyle = (layer, m) => ({
    color: '#333', weight: 3,
    fillColor: fillColor(layer, m), fillOpacity: 1,
  });

  // ---------- Đổi mode ----------
  const changeMode = (newMode) => {
    setMode(newMode);
    modeRef.current = newMode;

    // Reset tất cả layer về style mặc định của mode mới
    allLayersRef.current.forEach(l => l.setStyle(defaultStyle(l, newMode)));
    if (activeLayerRef.current) {
      activeLayerRef.current = null;
    }

    setPanel(
      newMode === 'province'
        ? { title: 'Chọn một tỉnh thành', region: '', info: 'Nhấp vào tỉnh để xem đặc thù.' }
        : { title: 'Chọn một tỉnh để xem vùng', region: '', info: 'Nhấp vào tỉnh bất kỳ — thông tin vùng nông nghiệp sẽ hiển thị.' }
    );
  };

  // ---------- Xử lý click ----------
  const handleClick = (layer) => {
    if (activeLayerRef.current) {
      activeLayerRef.current.setStyle(defaultStyle(activeLayerRef.current, modeRef.current));
    }
    layer.setStyle(activeStyle(layer, modeRef.current));
    activeLayerRef.current = layer;

    const pname = layer._provinceName;

    if (modeRef.current === 'province') {
      // Hiện tên + mô tả tỉnh
      setPanel({
        title  : pname,
        region : provinceToRegion[pname] || '',
        info   : info[pname] || 'Đang cập nhật thông tin đặc thù cho tỉnh này...',
      });
    } else {
      // Hiện mô tả vùng
      const rname = provinceToRegion[pname];
      if (rname) {
        setPanel({ title: rname, region: '', info: regions[rname] || 'Đang cập nhật...' });
      } else {
        setPanel({ title: pname, region: '', info: 'Chưa xác định vùng cho tỉnh này.' });
      }
    }
  };

  // ---------- Khởi tạo map 1 lần ----------
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([16.0, 107.5], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    mapInstanceRef.current = map;

    fetch('/vietnam34.geojson')
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(geo => {
        L.geoJSON(geo, {
          style: () => defaultStyle(null, 'province'),
          onEachFeature: (feature, layer) => {
            const name =
              feature.properties.TinhThanh ||
              feature.properties.Name ||
              feature.properties.name ||
              'Không rõ';
            layer._provinceName = String(name);
            allLayersRef.current.push(layer);

            layer.on('mouseover', () => {
              if (layer !== activeLayerRef.current) layer.setStyle(hoverStyle());
            });
            layer.on('mouseout', () => {
              if (layer !== activeLayerRef.current) {
                layer.setStyle(defaultStyle(layer, modeRef.current));
              }
            });
            layer.on('click', () => handleClick(layer));
          },
        }).addTo(map);
      })
      .catch(err => {
        console.error('Lỗi tải geojson:', err);
        setPanel({
          title: 'Lỗi',
          region: '',
          info: 'Không tải được file vietnam34.geojson. Đảm bảo file nằm trong thư mục /public.',
        });
      });

    // Cleanup khi unmount
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      allLayersRef.current = [];
    };
  }, []);

  return (
    <>
      <header>
        <h1>Bản đồ hành chính Việt Nam</h1>
        <p>34 tỉnh thành (cập nhật 2025) — Chọn chế độ xem bên dưới</p>
      </header>

      <div className="mode-switch">
        <button
          className={mode === 'province' ? 'active' : ''}
          onClick={() => changeMode('province')}
        >
          🗺️ Theo tỉnh
        </button>
        <button
          className={mode === 'region' ? 'active' : ''}
          onClick={() => changeMode('region')}
        >
          🌾 Theo vùng nông nghiệp
        </button>
      </div>

      <main className="container">
        <div id="map" ref={mapRef}></div>
        <aside className="info-panel">
          <h2>{panel.title}</h2>
          {panel.region && <div className="region-tag">🌾 {panel.region}</div>}
          <p>{panel.info}</p>
        </aside>
      </main>
    </>
  );
}