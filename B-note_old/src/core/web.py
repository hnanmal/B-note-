import webbrowser
import requests
from tqdm import tqdm  # pip install tqdm


def download_file_with_progress(url, save_path):
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get("content-length", 0))
    block_size = 8192

    with open(save_path, "wb") as file, tqdm(
        desc=save_path,
        total=total_size,
        unit="B",
        unit_scale=True,
        unit_divisor=1024,
    ) as progress_bar:
        for data in response.iter_content(block_size):
            file.write(data)
            progress_bar.update(len(data))

    print(f"✅ 다운로드 완료: {save_path}")


def open_url_in_browser(url):
    """
    기본 웹 브라우저로 지정된 URL을 엽니다.

    :param url: 열고자 하는 웹 주소 (예: "https://www.google.com")
    """
    try:
        webbrowser.open(url, new=2)  # new=2는 새 탭으로 열기
        print(f"🌐 브라우저에서 열기 성공: {url}")
    except Exception as e:
        print(f"❌ 브라우저 열기 실패: {e}")
