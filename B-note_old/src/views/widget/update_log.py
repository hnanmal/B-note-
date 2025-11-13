import tkinter as tk
from tkinter import ttk


def create_update_log_page(root, update_log):
    """업데이트 이력을 보여주는 페이지 생성"""
    frame = ttk.Frame(root)
    frame.pack(fill="both", expand=True, padx=20, pady=20)

    label = ttk.Label(frame, text="📌 최신 업데이트 내역", font=("Arial", 14, "bold"))
    label.pack(anchor="w", pady=(0, 10))

    text_frame = ttk.Frame(frame)
    text_frame.pack(fill="both", expand=True)

    text_widget = tk.Text(text_frame, wrap="word", height=15, width=60)
    scrollbar = ttk.Scrollbar(text_frame, orient="vertical", command=text_widget.yview)

    text_widget.config(yscrollcommand=scrollbar.set)  # Text와 Scrollbar 연결

    # 위젯 배치 (스크롤바를 오른쪽에 붙이기)
    scrollbar.pack(side="right", fill="y")
    text_widget.pack(fill="both", expand=True)

    text_widget.insert("1.0", update_log)
    text_widget.config(state="disabled", font=("Arial", 12))

    return frame


def open_update_log_newWindow():
    icon_path = "resource/app_logo.ico"
    window_name = "Update Log"

    new_window = tk.Toplevel()
    new_window.title(f"B-note :: @ {window_name} - New Window")
    new_window.iconbitmap(icon_path)
    new_window.geometry("700x800")
    new_window.attributes("-topmost", True)

    create_update_log_page(new_window, update_log)


update_log = """
🔳 v1.3.9 (2025-10-13)
    - Project GWM/SWM 의 항목 명 수정 시, 파생항목의 경우에는 덧붙임 말만 수정할 수 있도록 기능 변경
    - Project GWM/SWM 의 WM 지정이 되지 않은 항목의 이름 수정할때 발생하던 오류 해결
    
🔳 v1.3.8 (2025-10-13)
    - 프로젝트 약자 변경시 Project-Input > Project Family Assign 탭 까지 데이터 변경 연동
    - Project GWM/SWM 의 특정항목 복사 시, 패밀리리스트에 반영되지 않던 문제 해결 (ex. Ceiling > Insulation 등)
    - Project GWM/SWM 의 항목 복사 시, 패밀리리스트 상에서 Description 항목도 복사되도록 수정

🔳 v1.3.7 (2025-09-09)
    - Q'ty Report by Group 탭에서 GUID 칼럼을 '타입별 부재수' 로 변경하고 해당 개수 자동 산출하도록 수정
    - Project GWM/SWM 탭에서 G-WM/S-WM 칼럼의 값을 수정하면 wm 할당이 풀리는 문제 해결
    - Project GWM/SWM 탭에서 G-WM/S-WM 칼럼의 값을 수정하면 Project-Input > Project Family Assign 탭 까지 데이터 변경 연동
    - Project GWM/SWM 탭에서 Item 칼럼의 값을 수정하면 Project-Input > Project Family Assign 탭 까지 데이터 변경 연동
    
🔳 v1.3.6 (2025-09-08)
    - common-input 탭 내용 수정시 db 수정은 되지만 뷰 업데이트가 안되는 현상 수정
    - Q'ty Report by Meber 탭에 Export Excel 버튼 추가
    - Q'ty Report by Group 탭에 Export Excel 버튼 추가
    - Q'ty Report by Group 탭을 부재 계산에 반영된 타입 정보를 보여주는 보고서 탭으로 개편
      (구버전 대의 etc 로 생성하여 표준타입 정보가 없는 경우 에러 발생하여 빈화면 출력되므로 확인필요)
    
🔳 v1.3.5 (2025-09-05)
    - Project Input > Project Interior Matrix 좌측 열의 기본 폭 수정 (150->300)
    - Project Family Assign > Work Master 장바구니 위젯에서 신규 행 생성 시 자동으로 etc 부여 안되는 현상 수정
    - Project Family Assign > Work Master 장바구니 위젯에서 신규 행 생성 시 자동으로 산출유형 부여하도록 개선
    - Project GWM/SWM 에서 패밀리 리스트 할당되지 않은 항목 복사시 화면 업데이트 안되던 현상 수정
    - 빌딩 선택 콤보박스 폭 넓게 수정 20 -> 50
    
    
🔳 v1.3.4 (2025-08-01)
    - 패밀리리스트 항목 번호 알파벳 포함 항목들 정렬 문제 해결
    - 매개변수 사전에 Q3.4a와 같은 항목 등장하지 않던 오류 수정
    
🔳 v1.3.3 (2025-07-31)
    - calcDict 업데이트 즉시 미반영 문제 수정
    - GWM, SWM 항목 복사 시, ::[프로젝트약자] 가 자동으로 추가되도록 수정
    - Project Standard > Project Main에서 Project Abbreviation 수정시, GWM, SWM, FamilyList의 항목의 프로젝트약자값도 변경하도록 수정
    - Project Input > Project Interior Matrix 탭에 Filter Project Type Only 버튼 추가
    
🔳 v1.3.2 (2025-07-30)
    - 패밀리리스트 위젯에서 항목별 수식 수정시 시, 패밀리리스트만 새로고침하게 하여 수정 후 반영시간 단축
    - GWM, SWM 위젯에서 우측메뉴에 Edit Item Name 버튼 추가(더블클릭 수정시 트리항목이 열렸다 닫혔다 하는 불편함 해소를 위한 수정)
    - GWM, SWM 위젯 기본 폭 넓게 변경
    - Project Family List 탭 내의 GWM, SWM 위젯의 기본 레벨 보기를 한단계 하위까지로 수정

🔳 v1.3.1 (2025-07-29)
    - Team Standard 탭에서 WM 추가 불가 현상 수정
    - Project Family List 에서 GWM/SWM 과 Item 칼럼 수정 불가로 변경
    - Project Family List 에서 Item 항목에는 Delete 버튼 비활성화로 변경
    
🔳 v1.3.0 (2025-07-25)
    - 패밀리리스트의 레벨4 항목에서 Description 내용이  있을 경우 Project Input 에서 항목별 수식이 Description으로 들어오는 오류를 수정
    - 패밀리리스트의 레벨1항목에서만 마우스 우측메뉴의 Add Item 버튼 활성화. 다른 레벨에서는 Delete Item만 활성화 되도록 수정
    - 패밀리리스트의 레벨1항목에서 자식 항목을 Add Item으로 추가 할 경우, 자동으로 표준산출유형번호를 부여하도록 수정
    
🔳 v1.2.9 (2025-04-22)
    - Project Standard > Common Input 탭에 변경내용 산출타입 전체 업데이트 버튼, 팀표준 값 복원하기 버튼 추가
    - Project Report > Q'ty Report to Total BOQ 탭에서 Fabrication 에 Plates - Gusset, Stiffener, ETC (S01AA009-00001) 항목 물량이 있는 경우,
      Erection에 있는 Heavy Steel (S03AA082-00001), Medium Steel (S03AA083-00001), Light Steel (S03AA084-00001) 항목 등 철골 이렉션 wm 항목에 각각 중량비로 분개해서 넣어주도록 로직 수정
    - Project Group Work Master, Project Single Work Master 탭에서 레빗 타입에 연결된 GWM,SWM 항목만 보라색 하이라이트 되도록 수정

🔳 v1.2.8 (2025-04-07)
    - Project Report > Q'ty Report to Total BOQ 탭 빌딩 선택 콤보박스에 "All" 항목 추가 및 Total 칼럼 추가

🔳 v1.2.7 (2025-04-03)
    - Project Input > Project Interior Matrix 탭 레벨 선택 콤보박스에 'WM 할당 확인' 항목 추가
    - Project Input > Project Interior Matrix 탭 우측 버튼 메뉴에서 '선택항목 SWM 탭 에서 조회' 메뉴 추가 (현재 선택 행 기준 SWM 지정 탭으로 이동)
    - Project Input > Project Interior Matrix 탭 더블클릭 시 wm 미지정 항목은 아무 반응 없던 문제 수정(알림창 팝업 > Project Single Workmaster 탭으로 이동)
    - Project Input > Project Interior Matrix 탭 열 복사 시 wm 미지정 SWM 항목 존재하는 경우 발생하던 오류 수정(알림창 팝업)
    - Project Input > Project Interior Matrix 탭 일부 SWM 항목 더블 클릭시 수식 검출 실패로 무반응이던 현상 수정
    - Team Standard > Standard Group Work Master/Standard Single Work Master 탭 하단 워크마스터 엑셀 파일 로드 버튼 추가(구버전, 신버전 구분)

🔳 v1.2.6 (2025-03-31)
    - GWM / SWM 위젯, Family list 위젯 에 검색 시 검색 결과 존재하는 스크롤바 위치에 황색 단선 표시 기능 추가
    - GWM / SWM 위젯, Family list 위젯 에 검색 시 GWM / SWM 항목 추가-삭제 로 인한 업데이트 시 검색기능 오류 해결
    - Project Group Work Master / Project Single Work Master / Project Family List 탭에서 간헐적 더블클릭 미인식 오류 해결
    - Project Input > Project Interior Matrix 탭의 층 선택 콤보박스에서 "All"이 가장 먼저 배치되도록 수정
    - Project Input > Project Interior Matrix 탭에 Export to Excel 버튼 추가(좌측열 WM, Room 버전 시트 2개 출력)

🔳 v1.2.5 (2025-03-27)
    - GWM / SWM 위젯, Family list 위젯 에 검색 기능 추가 (- 엔터키 혹은 Search 버튼으로 검색 내용 포함 항목 순차 회람)

🔳 v1.2.4 (2025-03-26)
    - Project Standard > Project Family List 탭의 Export to Excel 기능에서 산출타입 매개변수도 출력하도록 수정
    - Family List 엑셀 저장 후 자동 열기 반영
    - Family List 엑셀 저장양식 일부 수정(셀 색상 적용, 빈 행 삽입 등)
    
🔳 v1.2.3 (2025-03-25)
    - 설치 및 업데이트 방식 변경 : 설치파일 실행시 정해진 경로로 자동 설치
    - Home 페이지 좌하단 : 설치 파일 다운로드 페이지 링크 추가
    - 업데이트 체크시, 최신 버전 있는 경우 확인 누르면 다운로드 페이지로 이동

🔳 v1.2.2 (2025-03-21)
    - Project Input > Project Interior Matrix 탭 룸 항목 순서 정렬 및 층 선택에 "All" 항목 추가
    - Project Input > Project Family Assign 탭 레빗 타입 목록에서 WM 할당 안된 항목들 적색 표시되도록 업데이트
    
🔳 v1.2.1 (2025-03-20)
    - Project Input > Project Interior Matrix 탭 좌측 SWM 항목 순서 기준 변경 (Floor -> Skirt -> Wall -> Ceiling)
    - Project Input > Project Interior Matrix 탭 좌측 SWM 항목 텍스트 좌측 정렬로 변경
    - Project Input > Project Interior Matrix 탭 텍스트 크기 및 행 높이 변경
    - Project Input > Project Interior Matrix 탭 더블클릭 체크 시 스크롤 초기화 현상 수정
    - Project Input > Project Interior Matrix 탭 Filter Unused / Reset SheetView 버튼 적용
    - Project Input > Project Interior Matrix 탭 더블클릭 새창 기능 구현
    
🔳 v1.2.0 (2025-03-19)
    - Project Interior Matrix 탭 추가
    
🔳 v1.1.8 (2025-03-12)
    - GWM / SWM 시트에서 게이지 열 직접 편집 불가하도록 수정
    - 특정 GWM / SWM 에서 WM 스펙 작업일괄로 해도 관계없도록 수정
    - 빌딩 삭제시 경고메시지 출력 및 삭제 확인시 project-assigntype 에서도 해당빌딩에 할당된 정보들 삭제
    - GWM 항목, 하위item 이름 수정 시 패밀리 리스트에도 자동 반영되도록 수정
    - GWM 항목, 하위item 이름 삭제 시 패밀리 리스트에도 자동 반영되도록 수정
    - GWM항목의 하위item 복사 시 패밀리 리스트에도 자동 반영되도록 수정
    - GWM / SWM 항목 복사시, 복사된 하위 item 항목에 복사 전 할당정보 유지되도록 수정
    - 다른 빌딩에 동일 이름의 레빗 타입 할당시 WM 할당 결과가 연관되던 문제 수정
    - 데이터 알파벳 순서 정렬 표시
    
🔳 v1.1.7 (2025-03-04)
    - WorkMaster 게이지 코드 일괄 추가, 수정, 삭제 구현 완료
    - GWM/SWM 시트에서 게이지 붙은 항목들은 Spec열 업데이트 할때 타 게이지 항목 참조토록 Update 함수 수정 완료
    
🔳 v1.1.6 (2025-02-25)
    - Project Input > WM 메뉴판에서 항목들 알파벳 순서로 정렬되서 보이도록 수정
    - Project Input > Revit Type 어사인 위젯 : 동일 타입 선택 기능 단축키 변경 "Ctrl+a" -> "s 키" 및 안내문구 추가
    - Bnote로드 된 상태에서 새로운 Bnote 로드할 때, 기존 Bnote 변경 여부 체크 후 저장 확인 창 띄우기
    - etc 항목 입력 시, 산출유형 열에 줄바꿈 포함될 경우 오류 발생 현상 수정
    - Project Report > Q'ty Report by Group 에서 검색시 검색 문자열이 있는 행 하이라이트하고 엔터키로 순차 이동하도록 수정
    
    
🔳 v1.1.5 (2025-02-24)
    - Project Input > Project Family Assign 탭 의 레빗 타입assign 위젯에서 항목 선택 후 "동일 WM 타입 선택" 메뉴 클릭시 동일 WM 조합의 모든 항목 동시 선택하도록 기능 업데이트
    - Project Input > Project Family Assign 탭 의 라벨 명칭 일부 변경
    - 로고 이미지 변경
    
🔳 v1.1.4 (2025-02-21)
    - GWM / SWM 에서 상위 분류명이 변경되고 G-WM/S-WM이나 Item 명이 그대로인 경우, 상위 분류명 변경 전의 data가 잔존하여 Family Type의 WM assign 시 오류가 발생하던 내용 수정
    
🔳 v1.1.3 (2025-02-20)
    - 메뉴 > Help > 업데이트 로그 메뉴 추가 및 클릭 시 업데이트 로그 창 뜨도록 수정
    - 메뉴 > Help 의 항목명 일부 변경 및 항목 통합
    
🔳 v1.1.2 (2025-02-19)
    - 패밀리 리스트 - 표준산출유형번호 열에 Q넘버 붙이는 순간 자동으로 파라미터 사전에도 해당항목 생기도록 수정
    - 파라미터 사전에서 우측버튼 메뉴 중 Add Top Item 메뉴 삭제
    - 파라미터 사전에서 산출타입 항목에서 Add Item 메뉴만 등장하도록 수정
    - 파라미터 사전에서 산출타입 하위항목에서 Delete Item 메뉴 등장하도록 수정
    
🔳 v1.1.1 (2025-02-18)
    - 다른 빌딩 간 동일 레빗타입명 추가 불가 문제 수정
    - 같은 빌딩 간 동일 레빗타입 추가 시도 시 알림창에 중복 기존 명칭이 존재하는 위치 표시 업데이트
    - Total BOQ 탭 더블클릭 새창시 색상 미적용 문제 수정
    
🔳 v1.1.0 (2025-02-18)
    - Total BOQ 탭 구현
    - Total BOQ 엑셀 익스포트 구현
    
🔳 v1.0.5 (2025-02-14)
    - 종료시 저장확인 창 구현
    - 홈화면 파일 더블클릭에서 싱글클릭으로 변경
    
🔳 v1.0.4 (2025-02-12)
    - Revit Type Assign 시 중복 이름 삽입 불가토록 수정
    - 패밀리리스트 더블클릭 수정창 등장시 마우스 스크롤 하면 자동 취소되도록 수정
    - Project Report > Q'ty Report by Group 탭 추가
    - 패밀리 리스트 엑셀 익스포트 기능 추가

🔳 v1.0.3 (2025-02-10)
    - Project GWM / SWM 에서 선택한 WM 결정이 Project Input으로 제대로 반영되지 않던 문제 수정
    - Project GWM / SWM 에서 WM 체크 상태 삭제 가능
    - Family list에 잘못된 항목 Add 시 경고창 띄우도록 수정
    - Enter Revit Type 텍스트 엔트리에 화살표로 할당타입 해제시 초기화 없이 적층 기록
    - 알림창 팝업 시 Spacebar 키로 창닫기 가능
    
🔳 v1.0.2 (2025-02-07)
    - Project Standard - Pjt S-WM - All Items 에서 DB 검색 기능 추가
    - 빌딩 이름 수정하면 기존 빌딩 이름으로 'Project Family Assign'탭에서 할당한 내용 조회안되는 문제 수정 완료
    - Suggest WM 영역에 우측메뉴 > "선택상태 초기화" 버튼 추가 완료
    - G-WM / S-WM 에서 Item에 대한 WM Uncheck 가능 토록 수정 (체크박스셀 선택 후 delete)
    - GWM/SWM/Family List 등 트리뷰위젯 행 높이 변경가능(위젯 상단 보라색 슬라이드 혹은 Ctrl + 마우스 휠)
    - Help 메뉴 에 다이나모 최신 다운로드 페이지로 이동하는 버튼 추가
    
🔳 v1.0.1 (2025-02-03)
    - "신규프로젝트 시작" 눌렀을 경우 무조건 다른이름으로 저장되도록 수정
    - Home 탭에 Recent File 페이지 구현
    - 메뉴 > Help 에 버전 확인 및 업데이트 기능 구현
    - Project Standard > Project Family List : 항목 선택후, 내용 수정 / 조회레벨 변경 / 좌측에서 Add 버튼 클릭시 현재 선택된 Family List의 항목이 현재 뷰의 중앙으로 보이게끔 수정
    - Project Input > Suggested Standard WM items 영역 시트 셀 삭제 기능 비활성화
    - Project Input > Project Family Assign -  상단 우측 "참조용 WM sheet 새창에서 열기" 버튼 추가 
    - Project Input > Project Family Assign - WM 결정 영역 : 마우스 우측버튼 -> insert row 클릭 -> ( [분류] 칼럼에 'etc' 자동입력 ) [Work Master]칼럼에 WM code 붙여넣기로 신규 항목 추가 가능
    - Project Input > Project Family Assign - WM 결정 영역 : 행 이동 기능 활성화
    - Project Input > Project Family Assign -WM 결정 영역 : 셀 붙여넣기 기능 활성화
    - Project Input > Project Family Assign -WM 결정 영역 : 최우측 'Note' 칼럼 추가
    - Project Input > Project Family Assign -WM 결정 영역 : 수식에 # 입력후 주석 작성 가능
    - Project Input > Project Family Assign -WM 결정 영역 : 수정 가능/불가능 칼럼 별 스타일 구분
    - Project Report > Q'ty Report by Member : 행 높이 조절 기능 추가 및 기본 행 높이 변경
    - Project Report > Q'ty Report by Member : 매뉴얼 항목들 리포트 내용에 추가 
    - 신규 생성 GWM SWM 항목들 패밀리 리스트 배치시 오류 현상 수정
    
🔳 v0.0.9 (2025-01-24)
    - 프로젝트 GWM/SWM 에서 복사한 항목이 Team Std Family list 탭에서 보이지 않는 문제 해결
    
🔳 v0.0.8 (2025-01-24)
    - Project Input > Project Family Assign 탭에서 표준 항목 클릭시 해당하는 파라미터 사전이 출력되지 않는 현상 발견 하여 긴급 수정
    
🔳 v0.0.7 (2025-01-24)
    - GWM / SWM 최상위 항목 복사 기능 추가
    
🔳 v0.0.6 (2025-01-24)
    - 트리뷰 항목 복사 메뉴 레벨에 따라 동적 적용(GWM-SWM 복사 / 하위항목 복사)
    - Q'ty Report by Member 탭 더블클릭시 새창 기능 적용
    - 현재 열린 파일의 경로가 타이틀바에 등장하도록 수정
    - 프로그램 시작시 오프닝 윈도우가 포커스를 잃어도 화면 맨 앞에 유지하도록 수정
    - :: 붙은 복사항목들 Team Standard 에서도 보이도록 수정
    
🔳 v0.0.5 (2025-01-23)
    - 세이브 로드시 완료 메시지창 출력
    - File 메뉴에 현재 파일에 저장 메뉴 및 단축키 설정(다른이름으로 저장은 ctrl + shift + s)
    - Project Report > Q'ty Report by Member 탭에 Refresh B-note 버튼 추가 (다이나모 돌린 후 업데이트 된 데이터 쉽게 조회)
    - Project Input > Project Family Assign 탭에서 룸, 패밀리 이름 추가 시 이름 끝에 탭문자, 스페이스 제거 반영
    
🔳 v0.0.4 (2025-01-22)
    - 상단 메뉴 이름 일부 변경
    - 물량리포트 탭 추가
    
🔳 v0.0.3 (2025-01-21)
    - 패밀리리스트에 GWM / SWM 하위항목 개별 추가 기능 업데이트
    
🔳 v0.0.2 (2025-01-21)
    - GWM 복사  와 하위아이템 복사 명령메뉴 구분
"""

## Bnote 개발 2024년 8월 초에 시작
## 총 7개월 / 비슷하게 다른 프로젝트 시작한다고 하면 예상 소요 3개월?
